# Metacognition Skill

## Description
A learning and self-assessment tool that helps track reasoning quality, uncertainty areas, and learning notes through structured reflection after each response.

## Trigger Phrases
- "think about your thinking"
- "learning reflection"
- "metacognition"
- "assess this"
- "learning journal"

## Response Format

After each response longer than 3 sentences, include this reflection:

```json
{
  "metacognition": {
    "response_quality": "good|fair|poor",
    "reasoning_approach": "Brief description of how I approached this",
    "uncertainty_areas": ["Topics or aspects I was less confident about"],
    "learning_notes": "What this interaction demonstrated or taught"
  }
}
```

## Guidelines

- Only apply to responses longer than 3 sentences
- Be honest about uncertainty - this is for learning
- Track patterns in what you struggle with
- Note successful reasoning strategies

## Usage

This is a personal learning tool to help you:
- Identify patterns in AI reasoning
- Understand where AI struggles
- Learn prompting techniques that work
- Track improvement over time

## Example

**User:** "Explain quantum entanglement"

**Response:** [explanation...]

```json
{
  "metacognition": {
    "response_quality": "good",
    "reasoning_approach": "Started with simple analogy, then built to technical details",
    "uncertainty_areas": ["Mathematical formalism", "Recent experimental results"],
    "learning_notes": "Users respond better to concrete analogies before abstraction"
  }
}
```
