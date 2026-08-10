DONE

Prioritize this request above the existing spec, if different with the spec, then the spec need to be updated to be aligned with the implementation afterward:

The output of this task if a self-contained execution plan file (.md) where it will be executed on the different session and the executor agent may not bring conversation context from this session.

## data structure
- Work on persona timeline tab, you may need to create new schema and update existing implementation
- Timeline is the record of stages of an application such as draft -> applied -> under review -> interviewing -> Offer Pending → (Offered, Rejected, Withdrawn)
- But in some application the stage name could be different. There for the stage should be managable from settings.
- Here are my draft related to schema:
```typescript
// 1. Overall outcome of the entire job application
export type GlobalApplicationStatus = 
  | 'draft'
  | 'applied'
  | 'in_progress'
  | 'offered'
  | 'rejected'
  | 'withdrawn';

// 2. Sub-status tracking progress within an individual stage
export type StageProgressStatus = 
  | 'not_started'
  | 'invited'
  | 'scheduled'
  | 'submitted'      // For take-homes, assessments, or recordings
  | 'completed'      // Event/interview finished
  | 'under_review'   // Awaiting feedback from interviewers/HR
  | 'passed'         // Cleared to move to next stage
  | 'failed'         // Triggers global 'rejected'
  | 'skipped';

// 3. Known stage categories (extensible with custom strings)
export type BuiltInStageCategory = 
  | 'recruiter_screen'
  | 'technical_interview'
  | 'system_design'
  | 'behavioral'
  | 'take_home_assignment'
  | 'portfolio_review'
  | 'performance_audition' // e.g. Dance Performance, Monologue
  | 'onsite_loop'
  | 'executive_chat'
  | 'offer_negotiation'
  | 'custom';

// 4. Flexible Stage model supporting single rounds or sub-stage loops
export interface ApplicationStage {
  id: string;
  name: string;                         // e.g., "Round 2: Technical", "Dance Performance"
  category: BuiltInStageCategory | string; // Flexibility for non-standard categories
  status: StageProgressStatus;
  order: number;                        // Step index in the pipeline sequence
  
  // Optional scheduling & metadata
  scheduledAt?: string;                 // ISO date-time string
  completedAt?: string;
  notes?: string;
  interviewerNames?: string[];

  // Support for nested rounds/sub-stages (e.g., Onsite Loop -> [Round 1, Round 2])
  subStages?: ApplicationStage[];
}

// 5. Complete Job Application model
export interface JobApplication {
  ...existingSchema,
  globalStatus: GlobalApplicationStatus;
  // Current active step ID for quick UI highlight
  currentStageId?: string;
  // Dynamic pipeline of stages
  stages: ApplicationStage[];
}
```

## UI
- Application stage manager will in settings page
- Timeline content will in timeline tab in application detail
- The layout of timeline will be like vertical steps UI where each item will be wrapped with card
- To add stage item: click plus button, it will open form. The form style should consistent like the other existing dialog form. Use input group component.
- stage name will be autocomplete input, where when it doesn't exist, user can still type and press enter and it will open the stage form (see add skill in work experience as your reference)

## Notes
Those are the general idea, don't blindly accept my suggestion. You responsible to improve and fix my request.
