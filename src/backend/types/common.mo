
module {
  /// A single chat message in conversation history
  public type ChatMessage = {
    role : Text;    // "user" | "assistant" | "system"
    content : Text;
  };

  /// Score breakdown across dimensions
  public type Breakdown = {
    confidence : Nat;
    humor : Nat;
    originality : Nat;
  };

  /// A pre-defined character profile for a challenge type
  public type CharacterProfile = {
    id : Text;               // challenge type key e.g. "easy-flirt"
    name : Text;
    age : Nat;
    personality : Text;
    conversation_style : Text;
    difficulty_behavior : Text;
    emoji_pattern : Text;    // "high" | "medium" | "low"
    starting_mood : Text;
  };

  /// Full response returned from a chat call
  public type ChatResponse = {
    reply : Text;
    interest_change : Int;
    updated_interest : Int;
    mood : Text;
    coach_hint : Text;
    coach_tone : Text;       // "positive" | "neutral" | "negative"
    score : Nat;
    breakdown : Breakdown;
    momentum : Text;            // "negative" | "neutral" | "positive"
    engagement_level : Text;    // "low" | "medium" | "high"
    conversation_tension : Text; // "low" | "building" | "high"
    feedbackCategory : Text;    // "positive" | "neutral" | "negative"
  };

  /// The AI character's evolving emotional state — persists across 5-round sessions
  public type CharacterState = {
    name : Text;
    age : Nat;
    personality : Text;
    var interest : Int;
    var mood : Text;
    conversation_style : Text;
    var momentum : Text;             // "negative" | "neutral" | "positive"
    var engagement_level : Text;     // "low" | "medium" | "high"
    var conversation_tension : Text; // "low" | "building" | "high"
  };
};
