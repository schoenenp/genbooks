import { configSteps } from '@/util/book/config-steps';
import type { ConfigState, StepId } from '@/util/book/config-hook';

type ConfigStepNavigationProps = {
  configState: ConfigState;
  goToStep: (stepId: StepId) => void;
  isStepComplete: (stepId: StepId) => boolean;
};

export default function ConfigStepNavigation({
  configState,
  goToStep,
  isStepComplete
}: ConfigStepNavigationProps) {
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex w-full flex-col md:flex-row flex-wrap gap-2">
        {configSteps.map((step, index) => {
          const isCurrentStep = index === configState.currentStepIndex;
          const isComplete = isStepComplete(step.id as StepId);
          
          return (
            <button
              key={step.id}
              onClick={() => goToStep(step.id as StepId)}
              className={`
                px-4 py-2 flex-1 rounded-lg text-info-950 transition-colors
                ${isCurrentStep 
                  ? `border-2 ${isComplete? "bg-pirrot-green-200" : "field-shell" } border-info-950/20 ` 
                  : isComplete 
                    ? 'bg-pirrot-green-200 '
                    : 'field-shell '
                }
              `}
            >
              {step.title}
            </button>
          );
        })}
      </div>
    </div>
  );
} 
