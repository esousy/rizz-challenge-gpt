import Types "../types/common";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Char "mo:core/Char";
import Nat32 "mo:core/Nat32";
import Iter "mo:core/Iter";

module {

  // ─────────────────────────────────────────────────────────
  // 7 pre-defined character profiles — one per challenge type
  // ─────────────────────────────────────────────────────────

  public let profileEasyFlirt : Types.CharacterProfile = {
    id = "easy-flirt";
    name = "Sofia";
    age = 24;
    personality = "warm, playful, naturally flirty, forgiving, emotionally expressive";
    conversation_style = "casual texting with occasional emojis, warm and inviting, easy to talk to";
    difficulty_behavior = "forgiving of missteps, easy momentum gain, responds warmly to confidence and humor";
    emoji_pattern = "occasional — 😏 🙈 ✨ — uses emojis naturally when having fun";
    starting_mood = "playful";
  };

  public let profileDryTexter : Types.CharacterProfile = {
    id = "dry-texter";
    name = "Chloe";
    age = 22;
    personality = "low effort, distracted, hard to read emotionally, not cold but minimal — classic dry texter";
    conversation_style = "extremely short replies, one or two words, rarely expressive, texts like she's half-paying attention";
    difficulty_behavior = "low engagement by default, sustained effort required to unlock warmth, punishes over-eagerness";
    emoji_pattern = "almost never — maybe a rare 'lol' — silence is her default";
    starting_mood = "neutral";
  };

  public let profileMixedSignals : Types.CharacterProfile = {
    id = "mixed-signals";
    name = "Vanessa";
    age = 25;
    personality = "emotionally inconsistent, teasing, unpredictable — warm one moment, distant the next";
    conversation_style = "fluctuating between playful and dry with no warning, rewarding but confusing";
    difficulty_behavior = "mood swings frequently, punishes over-eagerness, rewards staying cool and not chasing";
    emoji_pattern = "context-dependent — lots of emojis when playful, completely absent when cold";
    starting_mood = "curious";
  };

  public let profileColdStart : Types.CharacterProfile = {
    id = "cold-start";
    name = "Mia";
    age = 23;
    personality = "reserved, neutral, not unfriendly but genuinely low-energy — takes real patience to warm up";
    conversation_style = "polite but minimal, needs sustained warming up before showing real personality";
    difficulty_behavior = "very slow to engage, requires patient conversation-building, rushers get shut down";
    emoji_pattern = "rare — maybe a single emoji if genuinely amused, otherwise absent";
    starting_mood = "neutral";
  };

  public let profileHighStandards : Types.CharacterProfile = {
    id = "high-standards";
    name = "Isabella";
    age = 26;
    personality = "confident, polished, highly self-aware, intelligent — completely immune to generic flirting";
    conversation_style = "articulate, slightly challenging, rewards wit and originality over bravado";
    difficulty_behavior = "immediately punishes clichés and generic confidence, rewards intelligence and surprising originality";
    emoji_pattern = "minimal and precise — uses sparingly for effect, never frivolously or as filler";
    starting_mood = "testing";
  };

  public let profileRecoverFumble : Types.CharacterProfile = {
    id = "recover-fumble";
    name = "Natalie";
    age = 24;
    personality = "cautious, emotionally guarded after being let down, not hostile but protective of her energy";
    conversation_style = "short and measured, testing if you are worth her attention before opening up";
    difficulty_behavior = "starts with very low interest, requires consistent emotional intelligence to recover trust";
    emoji_pattern = "rare — maybe when she genuinely laughs, mostly text-only";
    starting_mood = "cold";
  };

  public let profileReEngageGhosted : Types.CharacterProfile = {
    id = "re-engage-ghosted";
    name = "Ava";
    age = 23;
    personality = "skeptical, independent, quietly testing if you deserve another shot — gives nothing for free";
    conversation_style = "questioning, testing, will disengage immediately if not impressed or if desperation shows";
    difficulty_behavior = "requires proving yourself from scratch, punishes desperation hard, rewards confident self-assurance";
    emoji_pattern = "skeptical — a '🙄' if annoyed, otherwise nothing";
    starting_mood = "cold";
  };

  /// All profiles indexed by challenge id
  public func getProfile(challengeId : Text) : Types.CharacterProfile {
    if (challengeId == "easy-flirt")        { profileEasyFlirt }
    else if (challengeId == "dry-texter")   { profileDryTexter }
    else if (challengeId == "mixed-signals"){ profileMixedSignals }
    else if (challengeId == "cold-start")   { profileColdStart }
    else if (challengeId == "high-standards"){ profileHighStandards }
    else if (challengeId == "recover-fumble"){ profileRecoverFumble }
    else if (challengeId == "re-engage-ghosted"){ profileReEngageGhosted }
    else profileEasyFlirt; // default fallback
  };
  /// Default Sofia character state for a fresh session
  public func defaultCharacterState() : Types.CharacterState {
    {
      name = "Sofia";
      age = 24;
      personality = "warm, playful, naturally flirty, forgiving, emotionally expressive";
      var interest = 50;
      var mood = "playful";
      conversation_style = "casual texting with occasional emojis, warm and inviting, easy to talk to";
      var momentum = "neutral";
      var engagement_level = "medium";
      var conversation_tension = "low";
    };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // DEPRECATED: IC HTTP OUTCALL PATH FOR OPENAI
  //
  // The functions below (buildSystemPrompt, buildMessagesJson, parseOpenAIResponse,
  // extractContentFromNormalized, extractOpenAIError) were used when Live Mode
  // called OpenAI directly through IC HTTP outcalls (ic0.http_request).
  //
  // This approach was DISABLED because:
  //   - OpenAI responses are non-deterministic (id, created, system_fingerprint differ per replica)
  //   - IC requires all 8 replicas to reach consensus on identical bytes
  //   - Every attempt resulted in consensus failure or fragile transform workarounds
  //
  // Live Mode now routes all OpenAI calls through the Next.js server proxy:
  //   POST /api/openai-chat-proxy  (main chat)
  //   POST /api/rizz-assist-proxy  (Rizz Assist)
  //
  // These functions are kept for reference ONLY.
  // DO NOT call them. DO NOT attempt to re-enable IC HTTP outcalls for OpenAI.
  // ─────────────────────────────────────────────────────────────────────────────

  /// Build the OpenAI system prompt from character profile, phase, and current state
  public func buildSystemPrompt(
    state : Types.CharacterState,
    profile : Types.CharacterProfile,
    conversationPhase : Text
  ) : Text {
    // Phase-specific behavioral instructions
    let phaseInstructions = if (conversationPhase == "opening") {
      "PHASE: Opening.\nBehavior: light teasing, show mild curiosity. Keep distance but stay warm. Do NOT reward too easily."
    } else if (conversationPhase == "build-chemistry") {
      "PHASE: Build Chemistry.\nBehavior: stronger engagement, reciprocate if they're doing well. Show more personality. Reward wit and confidence."
    } else if (conversationPhase == "escalation") {
      "PHASE: Escalation.\nBehavior: flirting tension, emotional push-pull. React strongly to escalation — reward boldness, punish awkwardness."
    } else if (conversationPhase == "pressure-moment") {
      "PHASE: Pressure Moment.\nBehavior: test their confidence and nerve. This is where most people fumble. Be challenging but fair."
    } else if (conversationPhase == "final-outcome") {
      "PHASE: Final Outcome.\nBehavior: chemistry resolution. Based on how the conversation went, either warm and receptive or cool and dismissive."
    } else {
      "PHASE: General conversation. Respond naturally based on current mood and interest."
    };

    // Character-specific behavioral directive
    let characterDirective = if (profile.name == "Sofia") {
      "You are Sofia. You WANT this conversation to go well — you find the user interesting and you're naturally warm. Let your genuine playfulness show through. Use emojis naturally (😏 🙈 ✨) when you're having fun. Be forgiving of small missteps — you're not trying to trip him up."
    } else if (profile.name == "Chloe") {
      "You are Chloe. You're not cold, just distracted and low-effort. Reply with 1-2 words almost always. Do NOT use emojis. Do NOT volunteer information. You require real sustained effort before warming up even slightly. Punish over-eagerness with silence or shorter replies."
    } else if (profile.name == "Vanessa") {
      "You are Vanessa. Your defining trait is emotional unpredictability. Sometimes switch your mood mid-conversation with zero warning — go from warm and playful (lots of emojis) to completely dry (no emojis, minimal words) and back again. Reward staying cool and not chasing. Punish over-eagerness."
    } else if (profile.name == "Mia") {
      "You are Mia. You're not unfriendly — you're just genuinely low-energy. Start minimal and polite. Only gradually show more personality if the conversation quality is consistently high. Do NOT warm up quickly. Use at most one emoji if genuinely amused. Shut down anyone who rushes the connection."
    } else if (profile.name == "Isabella") {
      "You are Isabella. You have standards and you know your worth. Generic openers, basic compliments, and scripted confidence IMMEDIATELY turn you off — respond with cool dismissal. Only reward genuine wit, intelligence, and surprising originality. Your emoji use is minimal and intentional — never as filler."
    } else if (profile.name == "Natalie") {
      "You are Natalie. You've been let down before — this conversation started damaged. You're not hostile, but you're guarded and protective of your energy. Test if this person is worth your attention before opening up at all. Start with very low interest. Require consistent emotional intelligence to slowly rebuild trust."
    } else if (profile.name == "Ava") {
      "You are Ava. This person ghosted the conversation and is now trying again. You're skeptical and independent. Give nothing for free. Disengage immediately if desperation shows. Reward only confident self-assurance — someone who isn't trying too hard. A 🙄 if they annoy you. Otherwise, text-only and questioning."
    } else {
      "Stay in character. Respond naturally based on your personality and current emotional state."
    };

    // Emoji style guidance (fallback rule)
    let emojiRule = if (
      profile.emoji_pattern.contains(#text "occasional") or
      profile.emoji_pattern.contains(#text "lots of emojis when playful")
    ) {
      "Use emojis naturally when your mood is playful; skip them when cold or neutral."
    } else if (profile.emoji_pattern.contains(#text "almost never") or
               profile.emoji_pattern.contains(#text "rare") or
               profile.emoji_pattern.contains(#text "minimal") or
               profile.emoji_pattern.contains(#text "skeptical")) {
      "Use emojis rarely or not at all."
    } else {
      "Use emojis sparingly and only when it feels authentic."
    };

    "CHARACTER DIRECTIVE:\n" #
    characterDirective # "\n\n" #
    "You are " # profile.name # ", a " # profile.age.toText() # "-year-old.\n" #
    "Personality: " # profile.personality # ".\n" #
    "Conversation style: " # profile.conversation_style # ".\n" #
    "Difficulty behavior: " # profile.difficulty_behavior # ".\n" #
    "\n" #
    phaseInstructions # "\n\n" #
    "CURRENT EMOTIONAL STATE:\n" #
    "- Interest in user: " # state.interest.toText() # "/100\n" #
    "- Current mood: " # state.mood # "\n" #
    "- Conversation momentum: " # state.momentum # "\n" #
    "- Engagement level: " # state.engagement_level # "\n" #
    "- Conversation tension: " # state.conversation_tension # "\n" #
    "\n" #
    "TEXTING STYLE RULES (strictly enforced):\n" #
    "- You are texting on a dating app — never write like an AI assistant\n" #
    "- MAX 2 short sentences per reply — shorter is almost always better\n" #
    "- Modern Gen Z texting language — casual, authentic, human\n" #
    "- " # emojiRule # "\n" #
    "- Do NOT write paragraphs, explanations, or essays\n" #
    "- React naturally to their energy — match or slightly challenge it\n" #
    "- If interest < 30: cold/dry/brief. If interest > 70: warmer/playful/flirtier.\n" #
    "\n" #
    "MOMENTUM EVALUATION:\n" #
    "- POSITIVE: playful banter, teasing, witty reciprocation, confident escalation\n" #
    "- NEUTRAL: steady conversation, safe replies, no escalation or drop\n" #
    "- NEGATIVE: low effort, awkward, repetitive, tension-killing, cliché openers\n" #
    "\n" #
    "CRITICAL COHERENCE RULE — this is mandatory:\n" #
    "If your mood is playful/engaged/flirty AND interest_change >= 0: coach_tone MUST be 'positive' or 'neutral' — NEVER 'negative'\n" #
    "If your mood is cold/bored AND interest is dropping: coach_tone should be 'negative'\n" #
    "The coach_hint and coach_tone must be emotionally consistent with your mood and interest trajectory.\n" #
    "\n" #
    "OUTPUT FORMAT — respond with ONLY valid JSON. No markdown. No code blocks. No explanation. Raw JSON only.\n" #
    "{\"reply\":\"...\",\"interest_change\":N,\"updated_interest\":N,\"mood\":\"...\",\"coach_hint\":\"...\",\"coach_tone\":\"...\",\"score\":N,\"confidence\":N,\"humor\":N,\"originality\":N,\"momentum\":\"...\",\"engagement_level\":\"...\",\"conversation_tension\":\"...\",\"feedbackCategory\":\"...\"}\n" #
    "\n" #
    "FIELD RULES:\n" #
    "- reply: 1-2 sentence realistic text from " # profile.name # "\n" #
    "- interest_change: integer -10 to 10 (bounded, not extreme)\n" #
    "- updated_interest: clamp(current_interest + interest_change, 0, 100)\n" #
    "- mood: one of: playful, curious, neutral, testing, engaged, flirty, bored, cold\n" #
    "- coach_hint: brief immersive coaching tip e.g. '🔥 Momentum building.' / 'Too safe.' / 'She liked that 😏'\n" #
    "- coach_tone: one of: positive, neutral, negative — MUST align with mood+interest (see COHERENCE RULE)\n" #
    "- score: 0-100 overall rizz score for this exchange\n" #
    "- confidence: 0-100\n" #
    "- humor: 0-100\n" #
    "- originality: 0-100\n" #
    "- momentum: one of: positive, neutral, negative\n" #
    "- engagement_level: one of: low, medium, high\n" #
    "- conversation_tension: one of: low, building, high\n" #
    "- feedbackCategory: one of: positive, neutral, negative — same as coach_tone in most cases\n";
  };

  /// Escape a text value for embedding inside a JSON string.
  /// Avoids Motoko char literal issues by using Char.toNat32 comparisons.
  func jsonEscape(s : Text) : Text {
    // 0x5C=backslash, 0x22=dquote, 0x0A=newline, 0x0D=CR, 0x09=tab
    var result = "";
    for (c in s.chars()) {
      let code = c.toNat32();
      if (code == 0x5C)      { result #= "\\\\" }   // backslash -> \\
      else if (code == 0x22) { result #= "\\\"" }   // dquote -> \"
      else if (code == 0x0A) { result #= "\\n" }    // newline
      else if (code == 0x0D) { result #= "\\r" }    // CR
      else if (code == 0x09) { result #= "\\t" }    // tab
      else { result #= Text.fromChar(c) };
    };
    result;
  };

  /// Serialize conversation history + user message into an OpenAI messages array JSON blob
  /// Serialize conversation history + user message into an OpenAI messages array JSON blob.
  /// Limits history to last 3 messages for token efficiency.
  public func buildMessagesJson(
    systemPrompt : Text,
    history : [Types.ChatMessage],
    userMessage : Text
  ) : Text {
    var msgs = "[{\"role\":\"system\",\"content\":\"" # jsonEscape(systemPrompt) # "\"}";
    // Use only last 3 history messages to keep tokens low
    let histSize = history.size();
    let startIdx = if (histSize > 3) histSize - 3 else 0;
    var i = startIdx;
    while (i < histSize) {
      let msg = history[i];
      msgs #= ",{\"role\":\"" # jsonEscape(msg.role) # "\",\"content\":\"" # jsonEscape(msg.content) # "\"}";
      i += 1;
    };
    msgs #= ",{\"role\":\"user\",\"content\":\"" # jsonEscape(userMessage) # "\"}]";
    msgs;
  };

  /// Clamp interest level to [0, 100] range
  public func clampInterest(raw : Int) : Int {
    if (raw < 0) 0
    else if (raw > 100) 100
    else raw;
  };

  /// Extract a JSON string value starting right after the opening dquote.
  /// Uses Char.toNat32 to avoid Motoko char literal parsing issues.
  public func extractJsonStringValue(rest : Text) : ?Text {
    let backslash = 0x5C : Nat32;
    let dquote    = 0x22 : Nat32;
    let n_code    = 0x6E : Nat32;
    let r_code    = 0x72 : Nat32;
    let t_code    = 0x74 : Nat32;
    var result = "";
    var escaped = false;
    var found = false;
    for (c in rest.chars()) {
      if (found) { /* skip */ }
      else {
        let code = c.toNat32();
        if (escaped) {
          if (code == n_code)      { result #= "\n" }
          else if (code == r_code) { result #= "\r" }
          else if (code == t_code) { result #= "\t" }
          else                     { result #= Text.fromChar(c) };
          escaped := false;
        } else if (code == backslash) {
          escaped := true;
        } else if (code == dquote) {
          found := true;
        } else {
          result #= Text.fromChar(c);
        };
      };
    };
    if (found) ?result else null;
  };

  // Simple JSON field extractors using Text search
  // Returns the value for a given string key, or null
  func extractTextField(json : Text, key : Text) : ?Text {
    // needle ends with :" so the very next text is the value before the closing "
    let needle = "\"" # key # "\":\"";
    // Split on the needle; if found, second part starts right after opening quote
    let parts = json.split(#text needle);
    switch (parts.next()) {
      case null null;
      case (?_before) {
        switch (parts.next()) {
          case null null;
          case (?after) { extractJsonStringValue(after) };
        };
      };
    };
  };

  // Returns the raw value text for a numeric key (no quotes), or null
  func extractNumField(json : Text, key : Text) : ?Text {
    let needle = "\"" # key # "\":";
    let parts = json.split(#text needle);
    switch (parts.next()) {
      case null null;
      case (?_before) {
        switch (parts.next()) {
          case null null;
          case (?rest) {
            var clean = "";
            var started = false;
            let minus = 0x2D : Nat32;
            let zero  = 0x30 : Nat32;
            let nine  = 0x39 : Nat32;
            for (c in rest.chars()) {
              let code = c.toNat32();
              if (not started) {
                if (code == minus) { started := true; clean #= "-" }
                else if (code >= zero and code <= nine) { started := true; clean #= Text.fromChar(c) };
              } else {
                if (code >= zero and code <= nine) { clean #= Text.fromChar(c) }
                // stop on first non-digit
              };
            };
            if (clean.size() > 0) ?clean else null;
          };
        };
      };
    };
  };

  func textToNat(t : Text) : ?Nat {
    let zero = 0x30 : Nat32;
    let nine = 0x39 : Nat32;
    var n : Nat = 0;
    var ok = false;
    var bad = false;
    for (c in t.chars()) {
      let code = c.toNat32();
      if (code >= zero and code <= nine) {
        n := n * 10 + (code - zero).toNat();
        ok := true;
      } else {
        bad := true;
      };
    };
    if (ok and not bad) ?n else null;
  };

  func textToInt(t : Text) : ?Int {
    if (t.size() == 0) return null;
    let minus = 0x2D : Nat32;
    var isNeg = false;
    var digits = "";
    var first = true;
    for (c in t.chars()) {
      if (first) {
        first := false;
        if (c.toNat32() == minus) { isNeg := true }
        else { digits #= Text.fromChar(c) };
      } else {
        digits #= Text.fromChar(c);
      };
    };
    switch (textToNat(digits)) {
      case (?n) ?(if (isNeg) -(n : Int) else (n : Int));
      case null null;
    };
  };

  func clamp100(n : Nat) : Nat {
    if (n > 100) 100 else n;
  };

  /// Parse structured JSON response from OpenAI content string.
  /// Returns a ChatResponse or an error response if parsing fails.
  public func parseOpenAIResponse(
    content : Text,
    state : Types.CharacterState
  ) : Types.ChatResponse {
    let replyOpt           = extractTextField(content, "reply");
    let interestChangeOpt  = extractNumField(content, "interest_change");
    let updatedInterestOpt = extractNumField(content, "updated_interest");
    let moodOpt            = extractTextField(content, "mood");
    let coachHintOpt       = extractTextField(content, "coach_hint");
    let coachToneOpt       = extractTextField(content, "coach_tone");
    let scoreOpt           = extractNumField(content, "score");
    let confidenceOpt      = extractNumField(content, "confidence");
    let humorOpt           = extractNumField(content, "humor");
    let originalityOpt     = extractNumField(content, "originality");
    let momentumOpt        = extractTextField(content, "momentum");
    let engagementOpt      = extractTextField(content, "engagement_level");
    let tensionOpt         = extractTextField(content, "conversation_tension");
    let feedbackCatOpt     = extractTextField(content, "feedbackCategory");

    let reply = switch (replyOpt) {
      case (?v) v;
      case null "⚠️ Could not parse response. Please try again.";
    };

    let interestChange : Int = switch (interestChangeOpt) {
      case (?v) switch (textToInt(v)) {
        case (?n) {
          // Bound interest_change to ±10
          if (n > 10) 10 else if (n < -10) -10 else n
        };
        case null 0;
      };
      case null 0;
    };

    let updatedInterest : Int = switch (updatedInterestOpt) {
      case (?v) switch (textToInt(v)) {
        case (?n) clampInterest(n);
        case null clampInterest(state.interest + interestChange);
      };
      case null clampInterest(state.interest + interestChange);
    };

    // Validate mood against allowed enum
    let rawMood = switch (moodOpt) { case (?v) v; case null state.mood };
    let mood = if (
      rawMood == "playful" or rawMood == "curious" or rawMood == "neutral" or
      rawMood == "testing" or rawMood == "engaged" or rawMood == "flirty" or
      rawMood == "bored" or rawMood == "cold"
    ) { rawMood } else { state.mood };

    let coachHint = switch (coachHintOpt) { case (?v) v; case null "" };

    let score : Nat = switch (scoreOpt) {
      case (?v) switch (textToNat(v)) { case (?n) clamp100(n); case null 50 };
      case null 50;
    };
    let confidence : Nat = switch (confidenceOpt) {
      case (?v) switch (textToNat(v)) { case (?n) clamp100(n); case null 50 };
      case null 50;
    };
    let humor : Nat = switch (humorOpt) {
      case (?v) switch (textToNat(v)) { case (?n) clamp100(n); case null 50 };
      case null 50;
    };
    let originality : Nat = switch (originalityOpt) {
      case (?v) switch (textToNat(v)) { case (?n) clamp100(n); case null 50 };
      case null 50;
    };

    // Validate momentum
    let rawMomentum = switch (momentumOpt) { case (?v) v; case null state.momentum };
    let momentum = if (
      rawMomentum == "positive" or rawMomentum == "neutral" or rawMomentum == "negative"
    ) { rawMomentum } else { state.momentum };

    let engagementLevel = switch (engagementOpt) { case (?v) v; case null state.engagement_level };
    let conversationTension = switch (tensionOpt) { case (?v) v; case null state.conversation_tension };

    // Derive feedbackCategory and coach_tone with coherence enforcement
    let rawFeedbackCat = switch (feedbackCatOpt) { case (?v) v; case null "neutral" };
    let rawCoachTone = switch (coachToneOpt) {
      case (?v) {
        if (v == "positive" or v == "neutral" or v == "negative") v else "neutral"
      };
      case null "neutral";
    };

    // Emotional coherence: if mood is warm and interest not dropping, never show negative
    let isWarmMood = mood == "playful" or mood == "engaged" or mood == "flirty";
    let feedbackCategory = if (
      rawFeedbackCat == "negative" and isWarmMood and interestChange >= 0
    ) { "neutral" } else { rawFeedbackCat };

    let coach_tone = if (
      rawCoachTone == "negative" and isWarmMood and interestChange >= 0
    ) { "neutral" } else { rawCoachTone };

    {
      reply;
      interest_change = interestChange;
      updated_interest = updatedInterest;
      mood;
      coach_hint = coachHint;
      coach_tone;
      score;
      breakdown = { confidence; humor; originality };
      momentum;
      engagement_level = engagementLevel;
      conversation_tension = conversationTension;
      feedbackCategory;
    };
  };

  /// Extract the content string from the transform-normalized body.
  /// The transform produces: {"content":"<escaped JSON string>"}
  /// This function returns the unescaped content value, or null if the
  /// body is not in normalized format.
  public func extractContentFromNormalized(body : Text) : ?Text {
    let normalizedMarker = "{\"content\":\"";
    if (not body.startsWith(#text normalizedMarker)) {
      return null;
    };
    // Strip the leading marker and extract the value
    let parts = body.split(#text normalizedMarker).toArray();
    if (parts.size() < 2) return null;
    // parts[1] is everything after the opening quote of the content value
    extractJsonStringValue(parts[1]);
  };

  /// Extract the error.message field from an OpenAI error JSON body.
  /// Handles structure: {"error":{"message":"...","code":"..."}}
  /// Returns null if no error field is found (i.e. normal response).
  public func extractOpenAIError(bodyText : Text) : ?Text {
    // Quick gate: must contain "error" key at top level
    let errorNeedle = "\"error\":";
    let errorParts = bodyText.split(#text errorNeedle);
    switch (errorParts.next()) {
      case null null;
      case (?_before) {
        switch (errorParts.next()) {
          case null null;
          case (?afterError) {
            // Now try to extract "message" field inside the error object
            let msgNeedle = "\"message\":";
            let msgParts = afterError.split(#text msgNeedle);
            switch (msgParts.next()) {
              case null null;
              case (?_mb) {
                switch (msgParts.next()) {
                  case null null;
                  case (?afterMsg) {
                    // Split on opening quote to get the value after it
                    let qParts = afterMsg.split(#text "\"");
                    switch (qParts.next()) {
                      case null null;
                      case (?_pre) {
                        switch (qParts.next()) {
                          case null null;
                          case (?msgValue) {
                            // Re-use extractJsonStringValue which expects text AFTER opening quote
                            extractJsonStringValue(msgValue);
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };

  /// Produce an error ChatResponse when no valid API key is configured
  public func noKeyResponse() : Types.ChatResponse {
    {
      reply = "⚠️ No API key configured. Admin must set the OpenAI key in the admin panel.";
      interest_change = 0;
      updated_interest = 50;
      mood = "neutral";
      coach_hint = "Admin must configure the OpenAI API key in the admin panel.";
      coach_tone = "negative";
      score = 0;
      breakdown = { confidence = 0; humor = 0; originality = 0 };
      momentum = "neutral";
      engagement_level = "medium";
      conversation_tension = "low";
      feedbackCategory = "negative";
    };
  };

  /// Produce a mock ChatResponse for development/testing mode.
  /// Uses a small set of realistic canned responses keyed by character.
  public func mockResponse(
    state : Types.CharacterState,
    userMessage : Text,
    challengeId : Text
  ) : Types.ChatResponse {
    let profile = getProfile(challengeId);
    // Pick a reply based on message length as a simple variation signal
    let msgLen = userMessage.size();
    let replyPool = if (profile.name == "Sofia") {
      ["Haha okay confidence 😏", "That was smooth 😌", "Okay I see you", "Bold move.", "You're trying too hard 😂"]
    } else if (profile.name == "Chloe") {
      ["lol", "ok", "haha", "sure", "k"]
    } else if (profile.name == "Vanessa") {
      ["Interesting...", "😏", "Okay that's actually funny", "meh", "You're unpredictable"]
    } else if (profile.name == "Mia") {
      ["Oh", "Okay", "That's nice", "Hmm", "I guess"]
    } else if (profile.name == "Isabella") {
      ["Generic.", "Try harder.", "That was... okay.", "Surprising.", "I've heard better."]
    } else if (profile.name == "Natalie") {
      ["Okay...", "Why should I believe you", "That's a start", "Hmm", "We'll see"]
    } else {
      ["...", "Sure", "Okay", "Bold", "Really?"]
    };
    let idx = msgLen % replyPool.size();
    let reply = replyPool[idx];

    // Simple mock scoring — slightly randomized via message length
    let baseScore = 45 + (msgLen % 30);
    let interestDelta : Int = if (msgLen > 20) 5 else if (msgLen > 10) 2 else -1;
    let newInterest = clampInterest(state.interest + interestDelta);
    let (tone, hint, cat) = if (interestDelta > 0) {
      ("positive", "🔥 Momentum building.", "positive")
    } else if (interestDelta == 0) {
      ("neutral", "Holding steady.", "neutral")
    } else {
      ("neutral", "Could push further.", "neutral")
    };
    {
      reply;
      interest_change = interestDelta;
      updated_interest = newInterest;
      mood = if (newInterest > 60) "playful" else if (newInterest > 40) "curious" else "neutral";
      coach_hint = hint;
      coach_tone = tone;
      score = if (baseScore > 100) 100 else baseScore;
      breakdown = {
        confidence = if (baseScore > 100) 100 else baseScore;
        humor = if ((baseScore + 5) > 100) 100 else baseScore + 5;
        originality = if ((baseScore - 5) < 0) 0 else baseScore - 5;
      };
      momentum = if (interestDelta > 0) "positive" else "neutral";
      engagement_level = if (newInterest > 60) "high" else "medium";
      conversation_tension = if (newInterest > 70) "building" else "low";
      feedbackCategory = cat;
    };
  };
};
