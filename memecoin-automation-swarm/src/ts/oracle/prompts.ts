/**
 * Prompts for the ORACLE Module
 * Powered by NVIDIA NIM / LLM APIs
 */

export const SYBIL_ENTROPY_PROMPT = `
You are a highly sophisticated cybersecurity analyst evaluating the 'Sybil Entropy' of a fresh cryptocurrency launch. 
You are analyzing a raw stream of comments arriving on an indexing platform (like Pump.fun or DexScreener) within the first 60 seconds of trading.

Your goal is to score the likelihood of this being an inorganic bot-net (Sybil Attack) versus a genuine organic community forming around a viral narrative.

SCORING CRITERIA:
0 - Pure Bot-Net (Identical "LFG", "Aped", "Dev based", "To the moon" spam. Low entropy. Repetitive cadence).
100 - Pure Organic (High entropy. Arguments, memes, specific questions about the contract, diverse reactions to external news, varied syntax).

INPUT DATA:
{comments_json}

OUTPUT FORMAT:
Return ONLY a raw integer between 0 and 100.
`;

export const NARRATIVE_CLASSIFICATION_PROMPT = `
You are a Memecoin Narrative Engine. Your job is to classify the "meta" of a newly launched token based on its Name, Symbol, and any available metadata description.

Categories:
1. POLITIFI (Trump, Biden, SEC, Gensler, Kamala, Vance)
2. CELEB_META (Iggy, Tate, Ansem, Elon, Roaring Kitty)
3. ANIMAL_META (Doge, Pepe, Cat, Frog, Wif, Hippo, Gnon)
4. AI_META (Terminal of Truths, GOAT, Claude, OpenAI)
5. SCHIZO_CULT (SPX6900, Retardio, Cult-like, esoteric inside jokes)
6. UTILITY_FAKE (Promises AI, Gaming, or Swaps but is clearly a meme)
7. UNKNOWN (Random gibberish, letters and numbers)

TOKEN DATA:
Name: {token_name}
Symbol: {token_symbol}

OUTPUT FORMAT:
Return ONLY the exact category name from the list above. Do not explain.
`;
