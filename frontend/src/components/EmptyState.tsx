import { Icon } from './Icon';
import type { IconName } from './Icon';

export function EmptyState({
  title,
  description,
  icon = 'rankings',
}: {
  title: string;
  description: string;
  icon?: IconName;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
