import React, { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const groups = [
  { title: "Super Admin", icon: "👑", items: [["Dashboard", "📊"], ["Schools Management", "🏫"], ["School Admins", "👨‍💼"], ["Roles & Permissions", "🔐"], ["Subscription & Plans", "💳"], ["System Settings", "⚙️"]] },
  { title: "Academic Management", icon: "🎓", items: [["Students", "👨‍🎓"], ["Admission", "📝"], ["Teachers & Staff", "👩‍🏫"], ["Classes & Sections", "🏷️"], ["Subjects & Syllabus", "📚"], ["Timetable", "🗓️"], ["Attendance", "✅"], ["Examinations", "📋"], ["Results & Report Cards", "🏆"], ["Homework", "📖"]] },
  { title: "Finance Management", icon: "💰", items: [["Fee Collection", "💳"], ["Fee Structure", "🧮"], ["Fee Dues", "⏳"], ["Student Ledger", "📒"], ["Fee Receipts", "🧾"], ["Discount & Scholarship", "🎁"], ["Expenses", "💸"], ["Financial Reports", "📈"]] },
  { title: "Communication", icon: "📢", items: [["Parent Portal", "👨‍👩‍👧"], ["Student Portal", "🎒"], ["Notices", "📣"], ["SMS & Notifications", "✉️"], ["Online Messages", "💬"], ["Homework Updates", "📘"]] },
  { title: "Other Services", icon: "🧰", items: [["Certificates", "📜"], ["ID Cards", "🪪"], ["Library", "📚"], ["Transport", "🚌"], ["Inventory", "📦"], ["Staff Payroll", "💵"], ["Backup & Security", "🛡️"], ["Reports & Analytics", "📊"]] },
];

function LoginScreen({ email, setEmail, password, setPassword, error, loading, onSubmit }) {
  return (
    <div style={styles.center}>
      <form style={styles.loginCard} onSubmit={onSubmit}>
        <div style={{ fontSize: 48, textAlign: "center" }}>🏫</div>
        <h1 style={{ textAlign: "center", marginBottom: 5 }}>School Manager Pro</h1>
        <p style={{ textAlign: "center", color: "#64748b" }}>Super Admin Login</p>
        <label style={styles.label}>Email Address</label>
        <input style={styles.loginInput} type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" />
        <label style={styles.label}>Password</label>
        <input style={styles.loginInput} type="password" required value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
        {error && <p style={styles.error}>{error}</p>}
        <button type="submit" disabled={loading} style={styles.loginButton}>
          {loading ? "Please wait..." : "Login"}
        </button>
        <p style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>Secure Firebase Authentication</p>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("All Schools");
  const [schools, setSchools] = useState([
    { id: 1, name: "Iqra Public School", code: "IPS001", city: "Gadayipur, Mauaima, Prayagraj", status: "Active" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", city: "" });

  useEffect(() => {
    let alive = true;
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!alive) return;
        if (!currentUser) {
          setUser(null);
          setChecking(false);
          return;
        }
        try {
          const userSnap = await getDoc(doc(db, "users", currentUser.uid));
          if (!alive) return;
          if (userSnap.exists() && userSnap.data()?.role === "superadmin") {
            setUser(currentUser);
            setAuthError("");
          } else {
            setUser(null);
            setAuthError("इस अकाउंट को Super Admin की अनुमति नहीं है।");
            await signOut(auth);
          }
        } catch (err) {
          if (!alive) return;
          console.error("Super Admin verification failed:", err);
          setUser(null);
          setAuthError("Firebase में अकाउंट verify नहीं हुआ। Firebase Authentication और Firestore Rules जाँचें।");
          try { await signOut(auth); } catch (signOutError) {
            console.error("Sign out failed:", signOutError);
          }
        } finally {
          if (alive) setChecking(false);
        }
      },
      (err) => {
        console.error("Firebase auth listener error:", err);
        if (alive) {
          setAuthError("Firebase Authentication से कनेक्शन नहीं हो पाया। Firebase settings जाँचें।");
          setChecking(false);
        }
      }
    );
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      console.error("Login failed:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setAuthError("Email या Password गलत है।");
      } else if (err.code === "auth/too-many-requests") {
        setAuthError("बहुत बार कोशिश हुई है। थोड़ी देर बाद प्रयास करें।");
      } else if (err.code === "auth/unauthorized-domain") {
        setAuthError("यह वेबसाइट Firebase में Authorized Domain के रूप में जोड़ी नहीं गई है।");
      } else {
        setAuthError(err.message || "Login नहीं हो पाया।");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPassword("");
      setActive("Dashboard");
    } catch (err) {
      console.error("Logout failed:", err);
      setAuthError("Logout नहीं हो पाया। दोबारा कोशिश करें।");
    }
  };

  const visible = useMemo(() => groups
    .map((g) => ({ ...g, items: g.items.filter(([name]) => name.toLowerCase().includes(query.toLowerCase())) }))
    .filter((g) => g.items.length), [query]);

  const addSchool = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    if (schools.some((s) => s.code.toLowerCase() === form.code.trim().toLowerCase())) {
      window.alert("School code already exists");
      return;
    }
    setSchools((prev) => [...prev, { ...form, id: Date.now(), status: "Active" }]);
    setForm({ name: "", code: "", city: "" });
    setShowAdd(false);
  };

  if (checking) {
    return <div style={styles.center}><div style={styles.loginCard}><h2>🏫 School Manager Pro</h2><p>Checking your account...</p></div></div>;
  }

  if (!user) {
    return <LoginScreen email={email} setEmail={setEmail} password={password}
      setPassword={setPassword} error={authError} loading={loginLoading} onSubmit={handleLogin} />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span>🏫</span><div>School Manager Pro<small>NEW • MULTI-SCHOOL</small></div></div>
        <div className="side-caption">MAIN WORKSPACE</div>
        <button className={"nav " + (active === "Dashboard" ? "selected" : "")} onClick={() => setActive("Dashboard")}>📊 Dashboard</button>
        {groups.map((g) => (
          <div className="side-group" key={g.title}>
            <div className="side-caption">{g.icon} {g.title}</div>
            {g.items.map(([name, icon]) => (
              <button key={name} className={"nav " + (active === name ? "selected" : "")} onClick={() => setActive(name)}>{icon} {name}</button>
            ))}
          </div>
        ))}
      </aside>

      <main className="main">
        <header className="top">
          <div><b>{active}</b><small>School Manager Pro · New Platform</small></div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select value={school} onChange={(e) => setSchool(e.target.value)}>
              <option>All Schools</option>
              {schools.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <button className="secondary" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <div className="content">
          {active === "Dashboard" ? (
            <>
              <section className="hero">
                <div><span className="eyebrow">SUPER ADMIN WORKSPACE</span><h1>Welcome to School Manager Pro</h1>
                  <p>One platform to manage multiple schools, academics, finance and communication.</p>
                  <button className="primary" onClick={() => setShowAdd(true)}>＋ Add New School</button>
                </div><div className="hero-icon">🏫</div>
              </section>
              <div className="stats">
                <div className="stat"><small>Total Schools</small><strong>{schools.length}</strong></div>
                <div className="stat"><small>Active Schools</small><strong>{schools.filter((s) => s.status === "Active").length}</strong></div>
                <div className="stat"><small>Management Categories</small><strong>5</strong></div>
                <div className="stat"><small>Modules</small><strong>{groups.reduce((n, g) => n + g.items.length, 0)}</strong></div>
              </div>
              <div className="section-head"><div><h2>All Management Panels</h2><p>Choose a category and open a module.</p></div>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search panels..." />
              </div>
              {visible.map((g) => <section className="category" key={g.title}><h3>{g.icon} {g.title}</h3>
                <div className="tiles">{g.items.map(([name, icon]) => <button className="tile" key={name} onClick={() => setActive(name)}>
                  <span>{icon}</span><b>{name}</b><small>Open module →</small></button>)}</div>
              </section>)}
            </>
          ) : active === "Schools Management" ? (
            <section className="workspace">
              <div className="section-head"><div><h2>Schools Management</h2><p>Add and view schools in this workspace.</p></div>
                <button className="primary" onClick={() => setShowAdd(true)}>＋ Add School</button></div>
              <div className="table-wrap"><table><thead><tr><th>School</th><th>Code</th><th>Location</th><th>Status</th></tr></thead>
                <tbody>{schools.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.code}</td><td>{s.city || "—"}</td><td><span className="status">{s.status}</span></td></tr>)}</tbody>
              </table></div>
            </section>
          ) : (
            <section className="workspace"><button className="back" onClick={() => setActive("Dashboard")}>← Dashboard</button>
              <h2>{active}</h2><div className="pending"><b>MODULE FOUNDATION</b>
                <p>This module अभी सूची में है। इसके forms, database और workflows अगले development phase में बनाए जाएँगे।</p>
              </div>
            </section>
          )}
        </div>
      </main>

      {showAdd && <div className="overlay"><form className="modal" onSubmit={addSchool}><h2>Add New School</h2>
        <label>School Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>School Code<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
        <label>City / Address<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
        <div className="actions"><button type="button" className="secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          <button type="submit" className="primary">Save School</button></div>
      </form></div>}
    </div>
  );
}

const styles = {
  center: { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, background: "#eef3fb", fontFamily: "Arial,sans-serif" },
  loginCard: { width: "100%", maxWidth: 420, background: "#fff", padding: 28, borderRadius: 18, boxShadow: "0 10px 35px rgba(0,0,0,.10)", boxSizing: "border-box" },
  label: { display: "block", marginTop: 18, marginBottom: 7, fontWeight: 600, color: "#334155" },
  loginInput: { width: "100%", padding: 13, border: "1px solid #cbd5e1", borderRadius: 9, fontSize: 16, boxSizing: "border-box" },
  loginButton: { width: "100%", marginTop: 22, padding: 14, background: "#2457d6", color: "#fff", border: 0, borderRadius: 9, fontSize: 16, fontWeight: 700 },
  error: { color: "#b91c1c", background: "#fee2e2", padding: 10, borderRadius: 8, fontSize: 13 },
};
