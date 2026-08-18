export default function UserList({ users }) {
  return (
    <div className="panel-block">
      <h2 className="panel-title">In the theater ({users.length})</h2>
      <ul className="user-list">
        {users.map((u) => (
          <li key={u.id}>
            <span className="dot" style={{ background: u.color }} />
            {u.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
