import React from 'react';
import type { GroupHeaderProps } from '../interfaces/ui.components';

export function GroupHeader({ group, running, onStart, onStop, onEdit, onDelete, labels }: GroupHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <h3 style={{ margin: 0 }}>{group.name}</h3>
      <div style={{ flex: 1 }} />
      {running ? (
        <button onClick={onStop}>{labels.stop}</button>
      ) : (
        <button onClick={onStart}>{labels.start}</button>
      )}
      <button onClick={onEdit}>{labels.edit}</button>
      <button onClick={onDelete}>{labels.delete}</button>
    </div>
  );
}
