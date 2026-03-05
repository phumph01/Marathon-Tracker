export type IsoDateString = string;

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TrainingWeek {
  weekStart: IsoDateString;
  dailyMiles: number[];
}

export interface TrainingSchedule {
  name: string;
  weeks: TrainingWeek[];
  plannedMilesByDate: Record<IsoDateString, number>;
  descriptionByDate: Record<IsoDateString, string>;
}
