interface Props {
  text: string;
  icon?: string;
}

export default function EmptyState({ text, icon = "∅" }: Props) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-text">{text}</div>
    </div>
  );
}
