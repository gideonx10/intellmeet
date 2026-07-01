export interface Notification {
  _id: string;
  recipient: string;
  type: "task_assigned" | "mentioned" | "meeting_summary_ready";
  message: string;
  meetingId?: string;
  read: boolean;
  createdAt: string;
}
