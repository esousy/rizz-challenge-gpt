module {
  /// Player account status
  public type Status = { #active; #suspended; #blocked };

  /// A registered player's full identity and auth record.
  /// Note: no `role` field — players are always players; admins live in AdminProfile.
  public type UserProfile = {
    id                 : Text;    // Unique user ID (SHA-256 derived)
    username           : Text;
    email              : Text;
    passwordHash       : Text;    // SHA-256 hex of password
    status             : Status;
    rank               : Text;    // Current rank label e.g. "Rookie"
    totalXp            : Nat;
    streak             : Nat;
    unlockedChallenges : [Text];
    createdAt          : Int;
    plan               : Text;    // "free" | "pro" — default "free"
  };

  /// Separate admin identity — no XP, rank, streak, or gameplay fields.
  public type AdminProfile = {
    id           : Text;    // SHA-256 derived admin ID
    username     : Text;
    email        : Text;
    passwordHash : Text;
    createdAt    : Int;
    lastLogin    : Int;     // updated on each successful login (immutable record; map.add replaces)
  };

  /// Public view of an admin (no passwordHash)
  public type PublicAdminProfile = {
    id        : Text;
    username  : Text;
    email     : Text;
    createdAt : Int;
    lastLogin : Int;
  };

  /// A single past session entry stored in history
  public type SessionHistoryEntry = {
    challengeId : Text;
    outcome     : Text;
    score       : Nat;
    finalMood   : Text;
    playedAt    : Int;
    isRanked    : Bool;   // true = official challenge session; false = resume/keep-talking
  };

  /// Configurable limits for the Free plan (admin-settable)
  public type FreePlanConfig = {
    rankedSessionsPerDay  : Nat;   // default 3
    rizzAssistPerSession  : Nat;   // default 1
    hintsPerSession       : Nat;   // default 3
  };

  /// Delta applied to each skill after a session (can be negative)
  public type SkillsDelta = {
    confidence      : Int;
    humor           : Int;
    originality     : Int;
    tension         : Int;
    socialAwareness : Int;
  };

  /// Full session result payload sent by the frontend after a completed session
  public type SessionResult = {
    sessionId       : Text;
    challengeType   : Text;
    characterName   : Text;
    outcomeType     : Text;
    finalInterest   : Nat;
    finalMood       : Text;
    rizzScore       : Nat;
    xpEarned        : Nat;
    skillsDelta     : SkillsDelta;
    bestMoment      : Text;
    areaToImprove   : Text;
    createdAt       : Int;    // Unix timestamp in nanoseconds
    isRanked        : Bool;   // true = official ranked session, false = resume/keep-talking
  };

  /// Accumulated gameplay stats for a player
  public type PlayerStats = {
    totalXP              : Nat;
    rankId               : Text;
    streakCount          : Nat;
    skillConfidence      : Nat;
    skillHumor           : Nat;
    skillOriginality     : Nat;
    skillTension         : Nat;
    skillSocialAwareness : Nat;
    bestScores           : [(Text, Nat)];
    sessionHistory       : [SessionHistoryEntry];
  };

  /// Public-safe player profile view (no passwordHash)
  public type PublicProfile = {
    id                 : Text;
    username           : Text;
    email              : Text;
    status             : Status;
    rank               : Text;
    totalXp            : Nat;
    streak             : Nat;
    unlockedChallenges : [Text];
    createdAt          : Int;
    plan               : Text;    // "free" | "pro"
  };

  /// Structured error type for auth operations
  public type AuthError = {
    #usernameTaken;
    #emailTaken;
    #unauthorized;
    #notFound;
    #blocked;
    #suspended;
    #wrongPassword;
    #invalidInput : Text;
  };
};
