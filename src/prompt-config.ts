/**
 * Operational settings declared in a prompt file's header comment:
 *
 *   <!--
 *   prompt-config:
 *     citations: required | off
 *     retrievalDepth: 4
 *   -->
 *
 * A prompt file is the unit of change in this project, so the settings
 * that change with it live in the file. A live model receives the prompt
 * text as instructions; the mock provider applies the same settings
 * mechanically (citations off → it returns no citations; retrievalDepth
 * → how many chunks the app retrieves). That is what makes a prompt swap
 * measurable offline, with no API key.
 */

export interface PromptConfig {
  citations: 'required' | 'off';
  retrievalDepth: number;
}

export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  citations: 'required',
  retrievalDepth: 4,
};

export function parsePromptConfig(promptText: string): PromptConfig {
  const header = /<!--([\s\S]*?)-->/.exec(promptText)?.[1] ?? '';
  const citations = /citations:\s*(required|off)/.exec(header)?.[1];
  const depthRaw = /retrievalDepth:\s*(\d+)/.exec(header)?.[1];
  const depth = depthRaw ? Number(depthRaw) : Number.NaN;
  return {
    citations: citations === 'off' ? 'off' : 'required',
    retrievalDepth:
      Number.isInteger(depth) && depth >= 1 ? depth : DEFAULT_PROMPT_CONFIG.retrievalDepth,
  };
}

/** The prompt text with the config comment removed (what a model sees). */
export function stripPromptConfig(promptText: string): string {
  return promptText.replace(/<!--[\s\S]*?-->/, '').trim();
}
