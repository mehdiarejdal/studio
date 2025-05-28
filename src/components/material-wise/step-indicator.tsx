import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
}

export function StepIndicator({ currentStep, totalSteps, stepNames }: StepIndicatorProps) {
  return (
    <div className="mb-8">
      <ol className="flex items-center w-full">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;

          return (
            <li
              key={stepNumber}
              className={cn(
                "flex w-full items-center",
                stepNumber < totalSteps ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block" : "",
                isCompleted ? "after:border-primary" : "after:border-muted",
                isActive || isCompleted ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
                  isActive ? "bg-primary text-primary-foreground" :
                  isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {stepNumber}
              </span>
              <span className={cn("ml-2 text-sm hidden md:inline-block", isActive ? "font-bold" : "")}>
                {stepNames[index]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
