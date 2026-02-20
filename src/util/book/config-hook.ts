import { useCallback, useReducer } from 'react';
import { configSteps } from './config-steps';

export type StepId = 'COVER' | 'PRE' | 'PLANNER' | 'POST' | 'OVERVIEW';
export type BookModules = Partial<Record<StepId, string[]>>;

export type ConfigState = {
  id?: string;
  name?: string | null;
  currentStepIndex: number;
  isValid: boolean;
  book?: BookData;
  // Remove steps array since we can derive this from book.modules
}

type BookData = {
  bookTitle?: string | null;
  subTitle?: string | null;
  binding?: string | null;
  modules: BookModules;  // Use the new type
  school?: string;
  region?: string | null;
  period?: {
    start?: Date;
    end?: Date;
  }
}

type ConfigAction =
  | { type: 'MODULE_PICK'; moduleId: string; step: StepId; isValid?: boolean }
  | { type: 'SET_DATA'; book: BookData; configIsValid: boolean }
  | { type: 'GO_TO_STEP'; stepIndex: number }
  | { type: 'GO_TO_NEXT_STEP' }
  | { type: 'GO_TO_PREVIOUS_STEP' };

function stepReducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case 'MODULE_PICK': {
      const { moduleId, step, isValid } = action;
      const currentModules = state.book?.modules ?? {};
      
      const updatedModules = {
        ...currentModules,
        [step]: [
          ...(currentModules[step] ?? []),
          moduleId
        ]
      };

      return {
        ...state,
        isValid: isValid ?? state.isValid,
        book: {
          ...state.book,
          modules: updatedModules
        }
      };
    }

    case 'SET_DATA': {
      const { book, configIsValid } = action;
      return {
        ...state,
        book,
        isValid: configIsValid ?? state.isValid
      };
    }

    case 'GO_TO_STEP': {
      return {
        ...state,
        currentStepIndex: action.stepIndex
      };
    }

    case 'GO_TO_NEXT_STEP': {
      return {
        ...state,
        currentStepIndex: Math.min(state.currentStepIndex + 1, configSteps.length - 1)
      };
    }

    case 'GO_TO_PREVIOUS_STEP': {
      return {
        ...state,
        currentStepIndex: Math.max(state.currentStepIndex - 1, 0)
      };
    }

    default:
      return state;
  }
}

export const useBookConfig = (initialData?: ConfigState) => {
  const [configState, dispatch] = useReducer(stepReducer, initialData ?? {
    currentStepIndex: 0,
    isValid: false,
  });

  const inputHandler = useCallback(async (
    step: StepId,
    moduleId: string,
    isValid: boolean
  ) => {
    dispatch({
      type: 'MODULE_PICK',
      moduleId,
      isValid,
      step
    });
  }, []);

  const setBookData = useCallback((
    inputData: BookData,
    configValidity: boolean
  ) => {
    dispatch({
      type: 'SET_DATA',
      book: inputData,
      configIsValid: configValidity
    });
  }, []);

  const goToStep = useCallback((stepId: string) => {
    const stepIndex = configSteps.findIndex(step => step.id === stepId);
    if (stepIndex === -1) return;
    dispatch({ type: 'GO_TO_STEP', stepIndex });
  }, []);

  const goToNextStep = useCallback(() => {
    dispatch({ type: 'GO_TO_NEXT_STEP' });
  }, []);

  const goToPreviousStep = useCallback(() => {
    dispatch({ type: 'GO_TO_PREVIOUS_STEP' });
  }, []);

  const getCurrentStep = useCallback(() => {
    return configSteps[configState.currentStepIndex];
  }, [configState.currentStepIndex]);

  const isStepComplete = useCallback((stepId: StepId) => {
    const stepConfig = configSteps.find(step => step.id === stepId);
    if (!stepConfig) return false;

    const selectedModules = configState.book?.modules?.[stepId] ?? [];

    // Check minimum required modules
    if (selectedModules.length < stepConfig.modules.min) {
        return false;
    }
    
    // Check maximum allowed modules (if max is not -1)
    if (stepConfig.modules.max !== -1 && selectedModules.length > stepConfig.modules.max) {
        return false;
    }
    
    // Check if all selected modules are allowed
    const allAllowed = selectedModules.every(module => 
        !stepConfig.modules.exclude.includes(module) &&
        (stepConfig.modules.include.length === 0 || stepConfig.modules.include.includes(module))
    );

    return allAllowed;
}, [configState.book?.modules]);

  const validateStep = useCallback((stepId: StepId, modules: string[]) => {
    const stepConfig = configSteps.find(step => step.id === stepId);
    if (!stepConfig) return false;

    // Check module count
    if (modules.length < stepConfig.modules.min) return false;
    if (stepConfig.modules.max !== -1 && modules.length > stepConfig.modules.max) return false;

    // Check module types
    return modules.every(module => 
      !stepConfig.modules.exclude.includes(module) &&
      (stepConfig.modules.include.length === 0 || stepConfig.modules.include.includes(module))
    );
  }, []);

  return {
    configState,
    inputHandler,
    setBookData,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    getCurrentStep,
    isStepComplete,
    validateStep
  };
};
