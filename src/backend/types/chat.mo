
module {
  /// Raw JSON structure expected back from OpenAI
  /// (parsed manually from the response blob)
  public type OpenAIChoice = {
    message : { role : Text; content : Text };
  };

  /// HTTP header key-value pair
  public type HttpHeader = {
    name : Text;
    value : Text;
  };

  /// Subset of IC management canister http_request_args
  public type HttpRequestArgs = {
    url : Text;
    max_response_bytes : ?Nat64;
    method : { #get; #head; #post };
    headers : [HttpHeader];
    body : ?Blob;
    transform : ?{
      function : shared query ({ response : HttpRequestResult; context : Blob }) -> async HttpRequestResult;
      context : Blob;
    };
  };

  public type HttpRequestResult = {
    status : Nat;
    headers : [HttpHeader];
    body : Blob;
  };
};
