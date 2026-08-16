interface Props {
  text?: string;
  title?: string;
  description?: string;
  icon?: string;
}

export default function EmptyState({ text, title, description, icon = "∅" }: Props) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-text">{text ?? [title, description].filter(Boolean).join(" ")}</div>
    </div>
  );
}
