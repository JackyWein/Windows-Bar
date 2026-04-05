import { Sparkles } from 'lucide-react';

interface OnboardingCardProps {
  readonly onOpenProviders: () => void;
}

const QUICK_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'google-gemini', name: 'Gemini' },
] as const;

export function OnboardingCard({ onOpenProviders }: OnboardingCardProps) {
  return (
    <div className="onboarding-card">
      <div className="onboarding-icon">
        <Sparkles size={28} />
      </div>
      <div className="onboarding-title">Set up AI Chat</div>
      <div className="onboarding-desc">
        Configure a provider and model to start chatting with AI
      </div>
      <button className="onboarding-btn" onClick={onOpenProviders}>
        Configure Provider
      </button>
      <div className="onboarding-providers">
        {QUICK_PROVIDERS.map((p) => (
          <button
            key={p.id}
            className="onboarding-provider-chip"
            onClick={onOpenProviders}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
