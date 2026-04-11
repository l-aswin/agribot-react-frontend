import { useNavigate } from 'react-router-dom';
import AgribotLogo from '../components/AgribotLogo';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('access_token');
    navigate('/');
  }

  return (
    <div className={styles.root}>
      <header className={styles.navbar}>
        <AgribotLogo size={36} textSize={20} dark={false} />
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </header>
      <main className={styles.main}>
        <h1>Dashboard</h1>
        <p>Coming soon.</p>
      </main>
    </div>
  );
}
