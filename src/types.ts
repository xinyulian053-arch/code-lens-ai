export type ExplainMode = 'brief' | 'guided' | 'deep' | 'review';

export interface CodeContext {
  code: string;
  language: string;
  fileName: string;
  rangeLabel: string;
  surroundingContext?: string;
}

export interface FlowStep {
  step: string;
  detail: string;
}

export interface Explanation {
  summary: string;
  purpose: string;
  flow: FlowStep[];
  inputsOutputs: string;
  risks: string[];
  highlights: string[];
  followUpPrompt: string;
  source: 'ai' | 'preview';
}

export interface AppState {
  selectedCode?: CodeContext;
  explanation?: Explanation;
  apiConfigured: boolean;
  model: string;
  apiBaseUrl: string;
  mode: ExplainMode;
}
