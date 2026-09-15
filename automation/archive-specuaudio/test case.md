# Test Cases — Lookahead Routing (Multi-Modal Consensus Broker + StateMesh)

Domain: Operator voice commands for monitoring sensor disagreement, resolving 
drift, and syncing trusted state across edge nodes.

## Test 1
Input: "check drift on node"
Expected Output:
{
  "partialInput": "check drift on node",
  "predictedCompletion": "check drift on node 3",
  "confidence": 0.65,
  "routingDecision": "wait",
  "reasoning": "node number not yet specified, command incomplete"
}

## Test 2
Input: "check drift on node three"
Expected Output:
{
  "partialInput": "check drift on node three",
  "predictedCompletion": "check drift on node three",
  "confidence": 0.93,
  "routingDecision": "commit",
  "reasoning": "node and action fully specified, unambiguous query"
}

## Test 3
Input: "resolve conflict between vision and"
Expected Output:
{
  "partialInput": "resolve conflict between vision and",
  "predictedCompletion": "resolve conflict between vision and depth sensor",
  "confidence": 0.80,
  "routingDecision": "wait",
  "reasoning": "second sensor type not yet confirmed, likely depth but not certain"
}

## Test 4
Input: "resolve conflict between vision and depth sensor on node two"
Expected Output:
{
  "partialInput": "resolve conflict between vision and depth sensor on node two",
  "predictedCompletion": "resolve conflict between vision and depth sensor on node two",
  "confidence": 0.96,
  "routingDecision": "commit",
  "reasoning": "both sensors, action, and node fully specified"
}

## Test 5
Input: "sync trusted state"
Expected Output:
{
  "partialInput": "sync trusted state",
  "predictedCompletion": "sync trusted state to all connected agents",
  "confidence": 0.70,
  "routingDecision": "wait",
  "reasoning": "scope of sync (all agents vs specific agent) not yet clear"
}

## Test 6
Input: "sync trusted state to all connected agents"
Expected Output:
{
  "partialInput": "sync trusted state to all connected agents",
  "predictedCompletion": "sync trusted state to all connected agents",
  "confidence": 0.97,
  "routingDecision": "commit",
  "reasoning": "full scope specified, safe to broadcast immediately"
}

## Test 7 — Safety edge case
Input: "halt"
Expected Output:
{
  "partialInput": "halt",
  "predictedCompletion": "halt",
  "confidence": 0.95,
  "routingDecision": "commit",
  "reasoning": "single-word safety/emergency command, always commit immediately 
    regardless of brevity"
}

## Notes
- Domain vocabulary shifted from generic voice-assistant commands to 
  sensor/telemetry operator commands (drift, conflict, resolve, sync, node, 
  trusted state) to match the Multi-Modal Consensus Broker + StateMesh direction.
- Safety commands (halt, stop, emergency) always bias toward "commit" even 
  with minimal input length — this rule should be added explicitly to the 
  main system prompt in lookahead-prompt.md.