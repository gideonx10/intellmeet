export interface ActionItem {
  _id?: string;
  text: string;
  assignee: string;
  done: boolean;
}

export interface Meeting {
  _id: string;
  title: string;
  meetingCode: string;
  host: { _id: string; name: string; avatar?: string };
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
