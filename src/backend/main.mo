import Types "types/common";
import UPTypes "types/user-profile";
import UPLib "lib/user-profile";
import ChatApi "mixins/chat-api";
import UserProfileApi "mixins/user-profile-api";


import Map "mo:core/Map";








actor {
  // Sofia's evolving character state — persists across rounds within a session
  let sofiaState : Types.CharacterState = {
    name               = "Sofia";
    age                = 24;
    personality        = "playful, confident, slightly sarcastic";
    var interest       = 50;
    var mood           = "curious";
    conversation_style = "short playful texting";
    var momentum             = "neutral";
    var engagement_level     = "medium";
    var conversation_tension = "low";
  };

  // Holds the admin-set OpenAI API key and global mock mode flag
  let openAIKeyRef = { var key : ?Text = null };
  let appConfig = { var mockMode : Bool = true };

  // Player auth + profile state — keyed by userId (Text)
  let profileMap     = Map.empty<Text, UPTypes.UserProfile>();
  let statsMap       = Map.empty<Text, UPTypes.PlayerStats>();
  let usernameMap    = Map.empty<Text, Text>();
  let emailMap       = Map.empty<Text, Text>();
  let playerSessions = Map.empty<Text, Text>();

  // Admin-only state — completely separate from player maps
  let adminProfileMap = Map.empty<Text, UPTypes.AdminProfile>();
  let adminUsernameMap = Map.empty<Text, Text>();
  let adminSessionMap  = Map.empty<Text, Text>();

  // Full session result objects keyed by userId
  let sessionResultsMap = Map.empty<Text, [UPTypes.SessionResult]>();

  // Free Plan configurable limits — admin-settable, globally applied to all free users
  let freePlanConfigRef = {
    var config : UPTypes.FreePlanConfig = {
      rankedSessionsPerDay = 3;
      rizzAssistPerSession = 1;
      hintsPerSession      = 3;
    }
  };

  include ChatApi(sofiaState, openAIKeyRef, appConfig);
  include UserProfileApi(
    profileMap,
    statsMap,
    usernameMap,
    emailMap,
    playerSessions,
    adminProfileMap,
    adminUsernameMap,
    adminSessionMap,
    sessionResultsMap,
    freePlanConfigRef,
  );

  // ──────────────────────────────────────────────────────────────
  // Admin settings — protected by admin session token
  // ──────────────────────────────────────────────────────────────

  /// Admin: store the OpenAI API key (requires admin session token)
  public shared func setOpenAIKey(token : Text, key : Text) : async { #ok; #err : UPTypes.AuthError } {
    if (not UPLib.isAdminToken(adminSessionMap, token)) { return #err(#unauthorized) };
    if (key.size() == 0) { return #err(#invalidInput "API key cannot be empty") };
    let prefix = "sk-";
    if (not key.startsWith(#text prefix)) { return #err(#invalidInput "API key must start with sk-") };
    openAIKeyRef.key := ?key;
    #ok
  };

  /// Public query: returns true if an OpenAI API key has been configured, false otherwise.
  /// No auth required — knowing whether a key exists is not sensitive.
  public query func getOpenAIKeyStatus() : async Bool {
    switch (openAIKeyRef.key) {
      case null false;
      case (?k) k.startsWith(#text "sk-");
    };
  };

  /// Authenticated query: returns the raw OpenAI API key so the frontend can
  /// call OpenAI directly (bypassing IC consensus). Requires a valid player or
  /// admin session token — unauthenticated callers get null.
  public query func getOpenAIKey(token : Text) : async ?Text {
    let isPlayer = playerSessions.get(token) != null;
    let isAdmin  = UPLib.isAdminToken(adminSessionMap, token);
    if (not isPlayer and not isAdmin) { return null };
    openAIKeyRef.key
  };

  /// Public query: returns the raw OpenAI API key without auth.
  /// The key is the single global admin-configured key — not user-specific.
  /// This allows anonymous/guest users to use Live Mode with the admin key.
  /// Intentionally public: the key is already used client-side for all players.
  public query func getOpenAIKeyPublic() : async ?Text {
    openAIKeyRef.key
  };

  /// Admin: set global mock/live mode (requires admin session token)
  public shared func setMockMode(token : Text, enabled : Bool) : async { #ok; #err : UPTypes.AuthError } {
    if (not UPLib.isAdminToken(adminSessionMap, token)) { return #err(#unauthorized) };
    appConfig.mockMode := enabled;
    #ok
  };

  /// Frontend: query current mock mode setting
  public query func getMockMode() : async Bool {
    appConfig.mockMode
  };
};
