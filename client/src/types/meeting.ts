export interface ActionItem {
  _id?: string;
  text: string;
  assignee: string;
  done: boolean;
  // Set once this action item has been converted to a task — reflects the task's
  // live assignee/status rather than the AI's original (possibly stale) suggestion.
  taskId?: {
    _id: string;
    status: "todo" | "in-progress" | "done";
    dueDate?: string;
    assignee: { _id: string; name: string; avatar?: string };
  } | null;
}

export interface MeetingParticipant {
  user: { _id: string; name: string; avatar?: string };
  role: "host" | "participant";
  joinedAt?: string;
  leftAt?: string;
}

export interface Meeting {
  _id: string;
  title: string;
  meetingCode: string;
  host: { _id: string; name: string; avatar?: string };
  participants: MeetingParticipant[];
  status: "scheduled" | "active" | "ended";
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  recording?: string;
  summary?: string;
  transcript?: string;
  actionItems: ActionItem[];
  createdAt: string;
}
