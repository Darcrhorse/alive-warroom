/**
 * SQF Parser - Extracts SQF code from LLM responses
 */

export class SQFParser {
  /**
   * Extract SQF code from LLM response
   * Looks for code blocks wrapped in ```sqf or ```
   */
  extractSQF(response: string): string | null {
    // Try to find SQF code block first
    const sqfBlockMatch = response.match(/```sqf\s*([\s\S]*?)```/i);
    if (sqfBlockMatch) {
      return sqfBlockMatch[1].trim();
    }

    // Try generic code block
    const codeBlockMatch = response.match(/```\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // No code block found
    return null;
  }

  /**
   * Extract reasoning from LLM response
   */
  extractReasoning(response: string): string | null {
    const reasoningMatch = response.match(/REASONING:\s*(.*?)(?=ACTION:|```|$)/is);
    if (reasoningMatch) {
      return reasoningMatch[1].trim();
    }
    return null;
  }

  /**
   * Extract action type from LLM response
   */
  extractAction(response: string): string | null {
    const actionMatch = response.match(/ACTION:\s*(\w+)/i);
    if (actionMatch) {
      return actionMatch[1].trim();
    }
    return null;
  }

  /**
   * Parse complete LLM response
   */
  parseResponse(response: string): {
    reasoning: string | null;
    action: string | null;
    sqf: string | null;
  } {
    return {
      reasoning: this.extractReasoning(response),
      action: this.extractAction(response),
      sqf: this.extractSQF(response)
    };
  }
}

export const sqfParser = new SQFParser();
