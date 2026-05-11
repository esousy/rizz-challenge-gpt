import Map "mo:core/Map";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Char "mo:core/Char";
import Nat32 "mo:core/Nat32";
import Array "mo:core/Array";
import Types "../types/user-profile";
import Nat8 "mo:core/Nat8";
import Nat "mo:core/Nat";
import Int "mo:core/Int";

module {

  // ──────────────────────────────────────────────────────────────
  // Password hashing — SHA-256 over UTF-8 bytes, returns hex Text
  // ──────────────────────────────────────────────────────────────

  func rotr32(x : Nat32, n : Nat32) : Nat32 {
    (x >> n) | (x << (32 - n))
  };

  func nat32ToHex(n : Nat32) : Text {
    let hexChars : [Char] = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];
    let nibble = func(shift : Nat32) : Text {
      Text.fromChar(hexChars[((n >> shift) & 0xF).toNat()])
    };
    nibble(28) # nibble(24) # nibble(20) # nibble(16) #
    nibble(12) # nibble(8)  # nibble(4)  # nibble(0)
  };

  /// Compute SHA-256 of a UTF-8 text and return lowercase hex string.
  public func sha256Hex(msg : Text) : Text {
    let k : [Nat32] = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
      0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
      0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
      0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
      0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
      0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    var h0 : Nat32 = 0x6a09e667;
    var h1 : Nat32 = 0xbb67ae85;
    var h2 : Nat32 = 0x3c6ef372;
    var h3 : Nat32 = 0xa54ff53a;
    var h4 : Nat32 = 0x510e527f;
    var h5 : Nat32 = 0x9b05688c;
    var h6 : Nat32 = 0x1f83d9ab;
    var h7 : Nat32 = 0x5be0cd19;

    // Encode message to bytes
    let rawBytes = msg.encodeUtf8();
    let raw : [Nat8] = rawBytes.toArray();
    let msgLen = raw.size();
    let bitLen : Nat = msgLen * 8;

    // Compute padded length (multiple of 64)
    let padLen = if (msgLen % 64 < 56) { 56 - msgLen % 64 } else { 120 - msgLen % 64 };
    let totalLen = msgLen + padLen + 8;

    // Build padded byte array
    let padded = Array.tabulate(totalLen, func(i : Nat) : Nat8 {
      if (i < msgLen) {
        raw[i]
      } else if (i == msgLen) {
        0x80
      } else if (i < msgLen + padLen) {
        0x00
      } else {
        // Big-endian 64-bit bit length in last 8 bytes
        let byteIdx : Nat = i - (msgLen + padLen); // 0..7
        if (byteIdx < 4) {
          0x00
        } else {
          let idx32 : Nat = 7 - byteIdx;
          Nat8.fromNat((bitLen / (if (idx32 == 0) 1 else if (idx32 == 1) 256 else if (idx32 == 2) 65536 else 16777216)) % 256)
        }
      }
    });

    // Process each 64-byte block
    var blockStart : Nat = 0;
    while (blockStart < totalLen) {
      let wm = Array.tabulate(64, func(i : Nat) : Nat32 {
        if (i < 16) {
          let b = func(j : Nat) : Nat32 { Nat32.fromNat(padded[blockStart + i * 4 + j].toNat()) };
          (b(0) << 24) | (b(1) << 16) | (b(2) << 8) | b(3)
        } else { 0 }
      });
      let ws = wm.toVarArray();
      var wi : Nat = 16;
      while (wi < 64) {
        let s0v = ws[wi - 15];
        let s1v = ws[wi - 2];
        let s0 = rotr32(s0v, 7)  ^ rotr32(s0v, 18) ^ (s0v >> 3);
        let s1 = rotr32(s1v, 17) ^ rotr32(s1v, 19) ^ (s1v >> 10);
        ws[wi] := ws[wi - 16] +% s0 +% ws[wi - 7] +% s1;
        wi += 1;
      };

      var a = h0; var b = h1; var c = h2; var d = h3;
      var e = h4; var f = h5; var g = h6; var hh = h7;

      var ri : Nat = 0;
      while (ri < 64) {
        let S1    = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
        let notE  : Nat32 = e ^ 0xFFFFFFFF;
        let ch    = (e & f) ^ (notE & g);
        let temp1 = hh +% S1 +% ch +% k[ri] +% ws[ri];
        let S0    = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
        let maj   = (a & b) ^ (a & c) ^ (b & c);
        let temp2 = S0 +% maj;
        hh := g; g := f; f := e; e := d +% temp1;
        d := c;  c := b; b := a; a := temp1 +% temp2;
        ri += 1;
      };

      h0 +%= a; h1 +%= b; h2 +%= c; h3 +%= d;
      h4 +%= e; h5 +%= f; h6 +%= g; h7 +%= hh;
      blockStart += 64;
    };

    nat32ToHex(h0) # nat32ToHex(h1) # nat32ToHex(h2) # nat32ToHex(h3) #
    nat32ToHex(h4) # nat32ToHex(h5) # nat32ToHex(h6) # nat32ToHex(h7)
  };

  // ──────────────────────────────────────────────────────────────
  // Input validation
  // ──────────────────────────────────────────────────────────────

  public func validateUsername(username : Text) : ?Types.AuthError {
    let sz = username.size();
    if (sz < 3 or sz > 20) {
      return ?(#invalidInput "Username must be 3-20 characters")
    };
    for (c in username.chars()) {
      let code = c.toNat32();
      let isAlpha = (code >= 65 and code <= 90) or (code >= 97 and code <= 122);
      let isDigit = code >= 48 and code <= 57;
      let isUnderscore = code == 95;
      if (not isAlpha and not isDigit and not isUnderscore) {
        return ?(#invalidInput "Username may only contain letters, digits, and underscores")
      };
    };
    null
  };

  public func validateEmail(email : Text) : ?Types.AuthError {
    if (not email.contains(#char '@')) {
      return ?(#invalidInput "Invalid email address")
    };
    null
  };

  public func validatePassword(password : Text) : ?Types.AuthError {
    if (password.size() < 6) {
      return ?(#invalidInput "Password must be at least 6 characters")
    };
    null
  };

  // ──────────────────────────────────────────────────────────────
  // Core profile operations
  // ──────────────────────────────────────────────────────────────

  public func isUsernameAvailable(
    usernames : Map.Map<Text, Text>,
    username  : Text,
  ) : Bool {
    usernames.get(username) == null
  };

  public func isEmailAvailable(
    emails : Map.Map<Text, Text>,
    email  : Text,
  ) : Bool {
    emails.get(email) == null
  };

  /// Signup: validate, hash password, store new player account.
  /// Admin accounts live in a separate adminProfiles map and are never created via this function.
  public func signup(
    profiles  : Map.Map<Text, Types.UserProfile>,
    usernames : Map.Map<Text, Text>,
    emails    : Map.Map<Text, Text>,
    username  : Text,
    email     : Text,
    password  : Text,
  ) : { #ok : Types.PublicProfile; #err : Types.AuthError } {
    switch (validateUsername(username)) { case (?e) return #err e; case null {} };
    switch (validateEmail(email)) { case (?e) return #err e; case null {} };
    switch (validatePassword(password)) { case (?e) return #err e; case null {} };
    let lowerUsername = username.toLower();
    if (usernames.get(lowerUsername) != null) { return #err(#usernameTaken) };
    let lowerEmail = email.toLower();
    if (emails.get(lowerEmail) != null) { return #err(#emailTaken) };
    let passwordHash = sha256Hex(password);
    let userId = sha256Hex(lowerUsername # lowerEmail # Time.now().toText());
    let profile : Types.UserProfile = {
      id                 = userId;
      username;
      email              = lowerEmail;
      passwordHash;
      status             = #active;
      rank               = "Rookie";
      totalXp            = 0;
      streak             = 0;
      unlockedChallenges = ["easy-flirt", "dry-texter"];
      createdAt          = Time.now();
      plan               = "free";
    };
    profiles.add(userId, profile);
    usernames.add(lowerUsername, userId);
    emails.add(lowerEmail, userId);
    #ok(toPublic(profile))
  };

  /// Login a player by email/username + password. Returns player session token on success.
  /// Only operates on player accounts — admin login uses adminLogin().
  public func login(
    profiles   : Map.Map<Text, Types.UserProfile>,
    usernames  : Map.Map<Text, Text>,
    emails     : Map.Map<Text, Text>,
    sessions   : Map.Map<Text, Text>,
    identifier : Text,
    password   : Text,
  ) : { #ok : { token : Text; profile : Types.PublicProfile }; #err : Types.AuthError } {
    let lowerIdent = identifier.toLower();
    let userIdOpt : ?Text = if (identifier.contains(#char '@')) {
      emails.get(lowerIdent)
    } else {
      usernames.get(lowerIdent)
    };
    let userId = switch (userIdOpt) {
      case null { return #err(#notFound) };
      case (?id) id;
    };
    let profile = switch (profiles.get(userId)) {
      case null { return #err(#notFound) };
      case (?p) p;
    };
    switch (profile.status) {
      case (#blocked)   { return #err(#blocked) };
      case (#suspended) {};  // allow login; gameplay gated separately
      case (#active)    {};
    };
    let hash = sha256Hex(password);
    if (hash != profile.passwordHash) { return #err(#wrongPassword) };
    let token = sha256Hex(userId # Time.now().toText());
    sessions.add(token, userId);
    #ok { token; profile = toPublic(profile) }
  };

  /// Admin login — authenticates against adminProfiles only, stores token in adminSessions.
  /// Does NOT create or touch player accounts.
  public func adminLogin(
    adminProfiles  : Map.Map<Text, Types.AdminProfile>,
    adminUsernames : Map.Map<Text, Text>,
    adminSessions  : Map.Map<Text, Text>,
    identifier     : Text,
    password       : Text,
  ) : { #ok : { token : Text; profile : Types.PublicAdminProfile }; #err : Types.AuthError } {
    let lowerIdent = identifier.toLower();
    let adminIdOpt : ?Text = if (identifier.contains(#char '@')) {
      var found : ?Text = null;
      adminProfiles.forEach(func(id : Text, ap : Types.AdminProfile) {
        if (ap.email == lowerIdent) { found := ?id };
      });
      found
    } else {
      adminUsernames.get(lowerIdent)
    };
    let adminId = switch (adminIdOpt) {
      case null { return #err(#notFound) };
      case (?id) id;
    };
    let admin = switch (adminProfiles.get(adminId)) {
      case null { return #err(#notFound) };
      case (?a) a;
    };
    let hash = sha256Hex(password);
    if (hash != admin.passwordHash) { return #err(#wrongPassword) };
    // Update lastLogin by replacing the record in the map
    let updatedAdmin = { admin with lastLogin = Time.now() };
    adminProfiles.add(adminId, updatedAdmin);
    let token = sha256Hex(adminId # Time.now().toText() # "admin");
    adminSessions.add(token, adminId);
    #ok { token; profile = toPublicAdmin(updatedAdmin) }
  };

  /// Invalidate an admin session token.
  public func adminLogout(
    adminSessions : Map.Map<Text, Text>,
    token         : Text,
  ) {
    adminSessions.remove(token)
  };

  /// Resolve an admin session token to an admin ID.
  public func resolveAdminSession(
    adminSessions : Map.Map<Text, Text>,
    token         : Text,
  ) : ?Text {
    adminSessions.get(token)
  };

  /// Return the public admin profile for a given admin session token.
  public func getAdminProfile(
    adminProfiles : Map.Map<Text, Types.AdminProfile>,
    adminSessions : Map.Map<Text, Text>,
    token         : Text,
  ) : ?Types.PublicAdminProfile {
    let adminId = switch (adminSessions.get(token)) {
      case null { return null };
      case (?id) id;
    };
    switch (adminProfiles.get(adminId)) {
      case null null;
      case (?a)  ?(toPublicAdmin(a));
    }
  };

  public func resolveSession(
    sessions : Map.Map<Text, Text>,
    token    : Text,
  ) : ?Text {
    sessions.get(token)
  };

  public func logout(
    sessions : Map.Map<Text, Text>,
    token    : Text,
  ) {
    sessions.remove(token)
  };

  public func getProfile(
    profiles : Map.Map<Text, Types.UserProfile>,
    userId   : Text,
  ) : ?Types.UserProfile {
    profiles.get(userId)
  };

  public func getPublicProfile(
    profiles : Map.Map<Text, Types.UserProfile>,
    userId   : Text,
  ) : ?Types.PublicProfile {
    switch (profiles.get(userId)) {
      case null null;
      case (?prof) ?(toPublic(prof));
    }
  };

  public func updateProfileStats(
    profiles           : Map.Map<Text, Types.UserProfile>,
    userId             : Text,
    rank               : Text,
    totalXp            : Nat,
    streak             : Nat,
    unlockedChallenges : [Text],
  ) : { #ok : Types.PublicProfile; #err : Types.AuthError } {
    switch (profiles.get(userId)) {
      case null { #err(#notFound) };
      case (?existing) {
        let updated = { existing with rank; totalXp; streak; unlockedChallenges };
        profiles.add(userId, updated);
        #ok(toPublic(updated))
      };
    }
  };

  public func updateUserStatus(
    profiles   : Map.Map<Text, Types.UserProfile>,
    _usernames : Map.Map<Text, Text>,
    targetId   : Text,
    newStatus  : Types.Status,
  ) : { #ok; #err : Types.AuthError } {
    switch (profiles.get(targetId)) {
      case null { #err(#notFound) };
      case (?prof) {
        profiles.add(targetId, { prof with status = newStatus });
        #ok
      };
    }
  };

  public func deleteUser(
    profiles  : Map.Map<Text, Types.UserProfile>,
    usernames : Map.Map<Text, Text>,
    emails    : Map.Map<Text, Text>,
    stats     : Map.Map<Text, Types.PlayerStats>,
    sessions  : Map.Map<Text, Text>,
    targetId  : Text,
  ) : { #ok; #err : Types.AuthError } {
    switch (profiles.get(targetId)) {
      case null { #err(#notFound) };
      case (?prof) {
        profiles.remove(targetId);
        usernames.remove(prof.username.toLower());
        emails.remove(prof.email);
        stats.remove(targetId);
        // Drop all sessions for this user
        let allTokens = sessions.entries().toArray();
        for ((tok, uid) in allTokens.values()) {
          if (uid == targetId) { sessions.remove(tok) };
        };
        #ok
      };
    }
  };

  /// Return all player profiles. Admin accounts are never stored in the player map,
  /// so this always returns only players.
  public func getAllUsers(
    profiles : Map.Map<Text, Types.UserProfile>,
  ) : [Types.PublicProfile] {
    profiles
      .entries()
      .map<(Text, Types.UserProfile), Types.PublicProfile>(func((_, prof) : (Text, Types.UserProfile)) { toPublic(prof) })
      .toArray()
  };

  public func getStats(
    stats  : Map.Map<Text, Types.PlayerStats>,
    userId : Text,
  ) : ?Types.PlayerStats {
    stats.get(userId)
  };

  public func saveStats(
    stats    : Map.Map<Text, Types.PlayerStats>,
    userId   : Text,
    newStats : Types.PlayerStats,
  ) : { #ok; #err : Types.AuthError } {
    stats.add(userId, newStats);
    #ok
  };

  /// One-time bootstrap: create the default admin in the adminProfiles map.
  /// Returns #err(#usernameTaken) if an admin with that username already exists.
  public func initAdmin(
    adminProfiles  : Map.Map<Text, Types.AdminProfile>,
    adminUsernames : Map.Map<Text, Text>,
    username       : Text,
    email          : Text,
    password       : Text,
  ) : { #ok : Types.PublicAdminProfile; #err : Types.AuthError } {
    let lowerUsername = username.toLower();
    if (adminUsernames.get(lowerUsername) != null) { return #err(#usernameTaken) };
    let lowerEmail = email.toLower();
    var emailTaken = false;
    adminProfiles.forEach(func(_ : Text, ap : Types.AdminProfile) {
      if (ap.email == lowerEmail) { emailTaken := true };
    });
    if (emailTaken) { return #err(#emailTaken) };
    let passwordHash = sha256Hex(password);
    let adminId = sha256Hex(lowerUsername # lowerEmail # "admin-bootstrap");
    let admin : Types.AdminProfile = {
      id           = adminId;
      username;
      email        = lowerEmail;
      passwordHash;
      createdAt    = Time.now();
      lastLogin    = 0;
    };
    adminProfiles.add(adminId, admin);
    adminUsernames.add(lowerUsername, adminId);
    #ok(toPublicAdmin(admin))
  };

  // ──────────────────────────────────────────────────────────────
  // Rank thresholds
  // ──────────────────────────────────────────────────────────────

  func xpToRank(xp : Nat) : Text {
    if (xp >= 1000) { "rizz-lord" }
    else if (xp >= 500) { "heartbreaker" }
    else if (xp >= 250) { "charmer" }
    else if (xp >= 100) { "smooth-talker" }
    else { "Rookie" }
  };

  func clampSkill(current : Nat, delta : Int) : Nat {
    let next : Int = Int.fromNat(current) + delta;
    if (next < 0) { 0 }
    else if (next > 100) { 100 }
    else { next.toNat() }
  };

  // ──────────────────────────────────────────────────────────────
  // Session persistence
  // ──────────────────────────────────────────────────────────────

  /// Save a completed session result, updating the player's accumulated stats.
  /// Adds the session to history (capped at 20), accumulates XP, recalculates rank,
  /// updates skills with clamping, and refreshes bestScores per challenge type.
  public func saveSession(
    profiles       : Map.Map<Text, Types.UserProfile>,
    stats          : Map.Map<Text, Types.PlayerStats>,
    userId         : Text,
    session        : Types.SessionResult,
  ) : { #ok; #err : Types.AuthError } {
    // Load or initialise stats
    let existing : Types.PlayerStats = switch (stats.get(userId)) {
      case (?s) s;
      case null {
        {
          totalXP              = 0;
          rankId               = "Rookie";
          streakCount          = 0;
          skillConfidence      = 50;
          skillHumor           = 50;
          skillOriginality     = 50;
          skillTension         = 50;
          skillSocialAwareness = 50;
          bestScores           = [];
          sessionHistory       = [];
        }
      };
    };

    // Accumulate XP and recalculate rank
    let newTotalXP = existing.totalXP + session.xpEarned;
    let newRank    = xpToRank(newTotalXP);

    // Update skills with clamping (0–100)
    let newConfidence      = clampSkill(existing.skillConfidence,      session.skillsDelta.confidence);
    let newHumor           = clampSkill(existing.skillHumor,           session.skillsDelta.humor);
    let newOriginality     = clampSkill(existing.skillOriginality,     session.skillsDelta.originality);
    let newTension         = clampSkill(existing.skillTension,         session.skillsDelta.tension);
    let newSocialAwareness = clampSkill(existing.skillSocialAwareness, session.skillsDelta.socialAwareness);

    // Update bestScores map — keep max per challenge type
    let bsMap = Map.empty<Text, Nat>();
    for ((ct, sc) in existing.bestScores.values()) {
      bsMap.add(ct, sc);
    };
    let prevBest = switch (bsMap.get(session.challengeType)) {
      case (?b) b;
      case null 0;
    };
    bsMap.add(session.challengeType, if (session.rizzScore > prevBest) session.rizzScore else prevBest);
    let newBestScores = bsMap.entries().map(func(e) = e).toArray();

    // Build legacy SessionHistoryEntry for backward-compat
    let entry : Types.SessionHistoryEntry = {
      challengeId = session.challengeType;
      outcome     = session.outcomeType;
      score       = session.rizzScore;
      finalMood   = session.finalMood;
      playedAt    = session.createdAt;
      isRanked    = session.isRanked;
    };

    // Prepend to history and keep last 20
    let oldHistory = existing.sessionHistory;
    let combined   = [entry].concat(oldHistory);
    let newHistory = if (combined.size() > 20) {
      combined.sliceToArray(0, 20)
    } else {
      combined
    };

    let newStats : Types.PlayerStats = {
      totalXP              = newTotalXP;
      rankId               = newRank;
      streakCount          = existing.streakCount;
      skillConfidence      = newConfidence;
      skillHumor           = newHumor;
      skillOriginality     = newOriginality;
      skillTension         = newTension;
      skillSocialAwareness = newSocialAwareness;
      bestScores           = newBestScores;
      sessionHistory       = newHistory;
    };
    stats.add(userId, newStats);

    // Also sync rank/XP back to the UserProfile for quick reads
    switch (profiles.get(userId)) {
      case null {};
      case (?prof) {
        profiles.add(userId, { prof with rank = newRank; totalXp = newTotalXP });
      };
    };
    #ok
  };

  /// Return all full session result objects for a user from the sessions map.
  public func getSessionHistory(
    sessionResultsMap : Map.Map<Text, [Types.SessionResult]>,
    userId            : Text,
  ) : [Types.SessionResult] {
    switch (sessionResultsMap.get(userId)) {
      case (?s) s;
      case null [];
    }
  };

  /// Append a SessionResult to the per-user sessions store (cap at 50).
  public func storeSessionResult(
    sessionResultsMap : Map.Map<Text, [Types.SessionResult]>,
    userId            : Text,
    session           : Types.SessionResult,
  ) {
    let existing = switch (sessionResultsMap.get(userId)) {
      case (?s) s;
      case null [];
    };
    let combined = [session].concat(existing);
    let capped   = if (combined.size() > 50) combined.sliceToArray(0, 50) else combined;
    sessionResultsMap.add(userId, capped);
  };

  public func toPublic(prof : Types.UserProfile) : Types.PublicProfile {
    {
      id                 = prof.id;
      username           = prof.username;
      email              = prof.email;
      status             = prof.status;
      rank               = prof.rank;
      totalXp            = prof.totalXp;
      streak             = prof.streak;
      unlockedChallenges = prof.unlockedChallenges;
      createdAt          = prof.createdAt;
      plan               = prof.plan;
    }
  };

  /// Admin: set a player's plan field ("free" | "pro").
  public func setUserPlan(
    profiles : Map.Map<Text, Types.UserProfile>,
    targetId : Text,
    plan     : Text,
  ) : { #ok; #err : Types.AuthError } {
    switch (profiles.get(targetId)) {
      case null { #err(#notFound) };
      case (?prof) {
        profiles.add(targetId, { prof with plan });
        #ok
      };
    }
  };

  /// Return the number of ranked sessions a user has played today (UTC date).
  /// Only entries with isRanked = true are counted.
  public func getTodayRankedSessionCount(
    stats  : Map.Map<Text, Types.PlayerStats>,
    userId : Text,
  ) : Nat {
    let history = switch (stats.get(userId)) {
      case null { return 0 };
      case (?s) s.sessionHistory;
    };
    // Derive today's UTC day index from the current time (nanoseconds → seconds → days)
    let nowSeconds : Int = Time.now() / 1_000_000_000;
    let todayDay   : Int = nowSeconds / 86_400;
    var count : Nat = 0;
    for (entry in history.values()) {
      if (entry.isRanked) {
        let entryDay : Int = (entry.playedAt / 1_000_000_000) / 86_400;
        if (entryDay == todayDay) { count += 1 };
      };
    };
    count
  };

  public func toPublicAdmin(admin : Types.AdminProfile) : Types.PublicAdminProfile {
    {
      id        = admin.id;
      username  = admin.username;
      email     = admin.email;
      createdAt = admin.createdAt;
      lastLogin = admin.lastLogin;
    }
  };

  /// Check whether a given token belongs to an active admin session.
  public func isAdminToken(
    adminSessions : Map.Map<Text, Text>,
    token         : Text,
  ) : Bool {
    adminSessions.get(token) != null
  };

  /// Alias kept for any call sites that pass profileMap as first arg (now ignored).
  public func isAdmin(
    _profiles     : Map.Map<Text, Types.UserProfile>,
    adminSessions : Map.Map<Text, Text>,
    token         : Text,
  ) : Bool {
    adminSessions.get(token) != null
  };

  public func isSuspended(
    profiles : Map.Map<Text, Types.UserProfile>,
    sessions : Map.Map<Text, Text>,
    token    : Text,
  ) : Bool {
    let userId = switch (sessions.get(token)) {
      case null { return false };
      case (?id) id;
    };
    switch (profiles.get(userId)) {
      case null false;
      case (?prof) {
        switch (prof.status) {
          case (#suspended) true;
          case _            false;
        };
      };
    }
  };
};
