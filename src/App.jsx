
import UsersTable from './components/UsersTable';

export default function App() {
  return (
    <div className="page-shell">
      {/* <header className="topbar">
        <div className="container nav">
          <div className="brand">User Table</div>
        </div>
      </header> */}
      <main>
        <section className="section">
          <div className="container">
            <UsersTable />
          </div>
        </section>
      </main>
    </div>
  );
}
