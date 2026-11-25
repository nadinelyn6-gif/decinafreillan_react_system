import { useState } from 'react';
import Panel from './Panel.jsx';

const FILTERS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['done', 'Done'],
];

export default function TasksPanel({
  tasks,
  busy,
  onAdd,
  onToggle,
  onRename,
  onDelete,
  onClearDone,
  notify,
}) {
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const remaining = tasks.filter((task) => !task.done).length;
  const completed = tasks.length - remaining;
  const visible = tasks.filter((task) =>
    filter === 'all' ? true : filter === 'done' ? task.done : !task.done
  );

  async function submitNew(event) {
    event.preventDefault();
    const value = title.trim();
    if (!value || busy) return;
    if (await onAdd(value)) setTitle('');
  }

  function startEdit(task) {
    setEditingId(task.id);
    setEditValue(task.t);
  }

  async function saveEdit() {
    const value = editValue.trim();
    if (!value) {
      notify('A task needs a title.');
      return;
    }
    const id = editingId;
    setEditingId(null);
    if (id && await onRename(id, value)) notify('Task renamed.');
  }

  return (
    <Panel
      title="05 / Tasks"
      right={`${remaining} ${remaining === 1 ? 'task' : 'tasks'} left`}
    >
      <form className="task-form" onSubmit={submitNew}>
        <input
          type="text"
          aria-label="New task"
          placeholder="Add a task (for example, Review chapter 4)"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="submit" className="btn gold" disabled={busy || !title.trim()}>
          Add task
        </button>
      </form>

      <div className="task-toolbar">
        <div className="task-filters" role="group" aria-label="Filter tasks">
          {FILTERS.map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={`chip${filter === key ? ' active' : ''}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="task-count">
          {tasks.length ? `${completed} of ${tasks.length} done` : 'No tasks yet'}
        </span>
      </div>

      {visible.length ? (
        <ul className="task-list">
          {visible.map((task) => (
            <li className={`task${task.done ? ' done' : ''}`} key={task.id}>
              <label className="task-main">
                <input
                  type="checkbox"
                  checked={Boolean(task.done)}
                  onChange={() => onToggle(task.id)}
                />
                {editingId === task.id ? (
                  <input
                    type="text"
                    className="task-edit"
                    aria-label="Edit task title"
                    autoFocus
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        saveEdit();
                      } else if (event.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                  />
                ) : (
                  <span className="task-title">{task.t}</span>
                )}
              </label>
              <div className="row task-actions">
                {editingId === task.id ? (
                  <button type="button" className="btn" onClick={saveEdit}>
                    Save
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={() => startEdit(task)}>
                    Edit
                  </button>
                )}
                <button type="button" className="btn" onClick={() => onDelete(task.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="task-empty">
          {tasks.length ? 'Nothing in this view.' : 'Add your first task above to get started.'}
        </div>
      )}

      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={onClearDone}
          disabled={!completed}
        >
          Clear completed
        </button>
      </div>

      <div className="meta">
        <span>Stored on the server</span>
        <span>Available offline in this browser</span>
      </div>
    </Panel>
  );
}
