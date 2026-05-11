import Map "mo:core/Map";
import Types "../types/user-profile";
import UserLib "../lib/user-profile";

/// Mixin that exposes the full native auth + user-profile API surface.
/// Profiles and stats are keyed by userId (Text). Usernames/emails map to userId.
/// Player sessions: playerSessions map token -> userId.
/// Admin sessions: adminSessions map token -> adminId (completely separate namespace).
mixin (
  profiles          : Map.Map<Text, Types.UserProfile>,
  stats             : Map.Map<Text, Types.PlayerStats>,
  usernames         : Map.Map<Text, Text>,
  emails            : Map.Map<Text, Text>,
  playerSessions    : Map.Map<Text, Text>,
  adminProfiles     : Map.Map<Text, Types.AdminProfile>,
  adminUsernames    : Map.Map<Text, Text>,
  adminSessions     : Map.Map<Text, Text>,
  sessionResultsMap : Map.Map<Text, [Types.SessionResult]>,
  freePlanConfigRef : { var config : Types.FreePlanConfig },
) {

  // ──────────────────────────────────────────────────────────────
  // Player auth endpoints
  // ──────────────────────────────────────────────────────────────

  /// Create a new player account with username, email, and password.
  /// Admin accounts are separate and cannot be created via this endpoint.
  public shared func signup(
    username : Text,
    email    : Text,
    password : Text,
  ) : async { #ok : Types.PublicProfile; #err : Types.AuthError } {
    UserLib.signup(profiles, usernames, emails, username, email, password)
  };

  /// Login a player with email-or-username + password. Returns a player session token.
  public shared func login(
    identifier : Text,
    password   : Text,
  ) : async { #ok : { token : Text; profile : Types.PublicProfile }; #err : Types.AuthError } {
    UserLib.login(profiles, usernames, emails, playerSessions, identifier, password)
  };

  /// Invalidate the given player session token.
  public shared func logout(token : Text) : async () {
    UserLib.logout(playerSessions, token)
  };

  /// Check whether a username is still available.
  public shared query func isUsernameAvailable(username : Text) : async Bool {
    UserLib.isUsernameAvailable(usernames, username.toLower())
  };

  // ──────────────────────────────────────────────────────────────
  // Admin auth endpoints (completely separate from player auth)
  // ──────────────────────────────────────────────────────────────

  /// One-time bootstrap: create the first admin in the admin-only store.
  /// Succeeds only when no admin with that username exists yet.
  public shared func initAdmin(
    username : Text,
    email    : Text,
    password : Text,
  ) : async { #ok : Types.PublicAdminProfile; #err : Types.AuthError } {
    UserLib.initAdmin(adminProfiles, adminUsernames, username, email, password)
  };

  /// Admin login — authenticates against adminProfiles, stores token in adminSessions.
  /// Does NOT create or touch player accounts.
  public shared func adminLogin(
    identifier : Text,
    password   : Text,
  ) : async { #ok : { token : Text; profile : Types.PublicAdminProfile }; #err : Types.AuthError } {
    UserLib.adminLogin(adminProfiles, adminUsernames, adminSessions, identifier, password)
  };

  /// Invalidate the given admin session token.
  public shared func adminLogout(token : Text) : async () {
    UserLib.adminLogout(adminSessions, token)
  };

  /// Check whether a token is a valid admin session token (query, cheap).
  public shared query func isAdminToken(token : Text) : async Bool {
    UserLib.isAdminToken(adminSessions, token)
  };

  /// Return the public admin profile for the given admin session token.
  public shared query func getAdminProfile(token : Text) : async ?Types.PublicAdminProfile {
    UserLib.getAdminProfile(adminProfiles, adminSessions, token)
  };

  // ──────────────────────────────────────────────────────────────
  // Player profile endpoints
  // ──────────────────────────────────────────────────────────────

  /// Returns the profile for the given player session token, or null.
  public shared query func getCallerProfile(token : Text) : async ?Types.PublicProfile {
    let userId = switch (UserLib.resolveSession(playerSessions, token)) {
      case null { return null };
      case (?id) id;
    };
    UserLib.getPublicProfile(profiles, userId)
  };

  /// Update the caller's mutable gameplay stats. Requires a valid player session token.
  public shared func saveCallerProgress(
    token              : Text,
    rank               : Text,
    totalXp            : Nat,
    streak             : Nat,
    unlockedChallenges : [Text],
  ) : async { #ok : Types.PublicProfile; #err : Types.AuthError } {
    let userId = switch (UserLib.resolveSession(playerSessions, token)) {
      case null { return #err(#unauthorized) };
      case (?id) id;
    };
    UserLib.updateProfileStats(profiles, userId, rank, totalXp, streak, unlockedChallenges)
  };

  /// Returns the caller's PlayerStats for the given player session token.
  public shared query func getCallerStats(token : Text) : async ?Types.PlayerStats {
    let userId = switch (UserLib.resolveSession(playerSessions, token)) {
      case null { return null };
      case (?id) id;
    };
    UserLib.getStats(stats, userId)
  };

  /// Persists the caller's PlayerStats. Requires a valid player session token.
  public shared func saveCallerStats(
    token    : Text,
    newStats : Types.PlayerStats,
  ) : async { #ok; #err : Types.AuthError } {
    let userId = switch (UserLib.resolveSession(playerSessions, token)) {
      case null { return #err(#unauthorized) };
      case (?id) id;
    };
    UserLib.saveStats(stats, userId, newStats)
  };

  /// Save a completed session result to the backend.
  /// Updates accumulated stats (XP, rank, skills, bestScores, sessionHistory).
  /// Requires a valid player session token.
  public shared func saveCallerSession(
    token   : Text,
    session : Types.SessionResult,
  ) : async { #ok; #err : Types.AuthError } {
    let userId = switch (UserLib.resolveSession(playerSessions, token)) {
      case null { return #err(#unauthorized) };
      case (?id) id;
    };
    // Store the full session result for retrieval
    UserLib.storeSessionResult(sessionResultsMap, userId, session);
    // Update accumulated stats
    UserLib.saveSession(profiles, stats, userId, session)
  };

  /// Return the caller's full session result history (most recent first, max 50).
  public shared query func getCallerSessions(token : Text) : async [Types.SessionResult] {
    let userId = switch (UserLib.resolveSession(playerSessions, token)) {
      case null { return [] };
      case (?id) id;
    };
    UserLib.getSessionHistory(sessionResultsMap, userId)
  };

  // ──────────────────────────────────────────────────────────────
  // Admin user management endpoints
  // All admin endpoints require a valid adminSessions token.
  // Admin accounts NEVER appear in player lists.
  // ──────────────────────────────────────────────────────────────

  /// Admin: list all registered PLAYER accounts. Never returns admin accounts.
  public shared query func getAllUsers(token : Text) : async { #ok : [Types.PublicProfile]; #err : Types.AuthError } {
    if (not UserLib.isAdminToken(adminSessions, token)) { return #err(#unauthorized) };
    #ok (UserLib.getAllUsers(profiles))
  };

  /// Admin: update a player's status (active/suspended/blocked).
  public shared func updateUserStatus(
    token     : Text,
    targetId  : Text,
    newStatus : Types.Status,
  ) : async { #ok; #err : Types.AuthError } {
    if (not UserLib.isAdminToken(adminSessions, token)) { return #err(#unauthorized) };
    UserLib.updateUserStatus(profiles, usernames, targetId, newStatus)
  };

  /// Admin: permanently delete a player and all their data.
  public shared func deleteUser(
    token    : Text,
    targetId : Text,
  ) : async { #ok; #err : Types.AuthError } {
    if (not UserLib.isAdminToken(adminSessions, token)) { return #err(#unauthorized) };
    UserLib.deleteUser(profiles, usernames, emails, stats, playerSessions, targetId)
  };

  // ──────────────────────────────────────────────────────────────
  // Free Plan config endpoints
  // ──────────────────────────────────────────────────────────────

  /// Public query: return the current Free Plan limits.
  public shared query func getFreePlanConfig() : async Types.FreePlanConfig {
    freePlanConfigRef.config
  };

  /// Admin: update the Free Plan limits.
  public shared func setFreePlanConfig(
    token  : Text,
    config : Types.FreePlanConfig,
  ) : async { #ok; #err : Types.AuthError } {
    if (not UserLib.isAdminToken(adminSessions, token)) { return #err(#unauthorized) };
    freePlanConfigRef.config := config;
    #ok
  };

  /// Admin: set a player's plan ("free" | "pro").
  public shared func setUserPlan(
    adminToken : Text,
    userId     : Text,
    plan       : Text,
  ) : async { #ok; #err : Types.AuthError } {
    if (not UserLib.isAdminToken(adminSessions, adminToken)) { return #err(#unauthorized) };
    UserLib.setUserPlan(profiles, userId, plan)
  };

  /// Return the count of ranked sessions the caller has played today (UTC day).
  public shared query func getTodayRankedSessionCount(token : Text) : async Nat {
    let userId = switch (UserLib.resolveSession(playerSessions, token)) {
      case null { return 0 };
      case (?id) id;
    };
    UserLib.getTodayRankedSessionCount(stats, userId)
  };
};
