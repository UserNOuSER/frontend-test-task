import React, { useEffect, useState, useRef } from 'react';

const SORT_FIELDS = {
  fio: 'lastName',
  age: 'age',
  gender: 'gender',
  phone: 'phone',
};

function SortIndicator({ state }) {
  if (!state || state === 'none') return null;
  return state === 'asc' ? ' ▲' : ' ▼';
}

const COLUMNS = [
  { key: 'fio', label: 'Фамилия / Имя / Отчество' },
  { key: 'age', label: 'Возраст' },
  { key: 'gender', label: 'Пол' },
  { key: 'phone', label: 'Телефон' },
  { key: 'email', label: 'Email' },
  { key: 'country', label: 'Страна' },
  { key: 'city', label: 'Город' },
];

export default function UsersTable() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [sort, setSort] = useState({ field: null, order: 'none' });

  // фильтры
  const [qName, setQName] = useState('');
  const [gender, setGender] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [qPhone, setQPhone] = useState('');

  // Пагинация
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // модальное окно для отображения информации о пользователе
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  // ширина колонок в пикселях, по умолчанию
  const [colWidths, setColWidths] = useState(() => ({
    fio: 260,
    age: 90,
    gender: 110,
    phone: 160,
    email: 260,
    country: 160,
    city: 160,
  }));

  const tableRef = useRef(null);
  const resizing = useRef({ key: null, startX: 0, startWidth: 0 });
  
  // Обработчики событий для изменения ширины колонок
  useEffect(() => {   
    function onMouseMove(e) {
      if (!resizing.current.key) return;
      const { key, startX, startWidth } = resizing.current;
      const dx = e.clientX - startX;
      const next = Math.max(50, Math.round(startWidth + dx));
      setColWidths((prev) => ({ ...prev, [key]: next }));
    }
    function onMouseUp() {
      resizing.current.key = null;
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Получение всех данных пользователей с последующей фильтрацией, сортировкой и пагинацией на клиенте
  useEffect(() => {
  const controller = new AbortController();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // загружаем все данные чтобы узнать скролко всего пользователей, затем фильтруем и сортируем на клиенте
      const url = `https://dummyjson.com/users?limit=0`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let items = data.users || [];

      // фильтрация на клиенте
      if (qName) {
        const search = qName.toLowerCase();
        items = items.filter((u) => 
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(search) ||
          u.username?.toLowerCase().includes(search)
        );
      }
      
      if (qPhone) {
        const search = qPhone.toLowerCase();
        items = items.filter((u) => u.phone?.toLowerCase().includes(search));
      }

      if (gender) {
        items = items.filter((u) => String(u.gender).toLowerCase() === String(gender).toLowerCase());
      }
      
      if (minAge) {
        items = items.filter((u) => Number(u.age) >= Number(minAge));
      }
      
      if (maxAge) {
        items = items.filter((u) => Number(u.age) <= Number(maxAge));
      }

      // сортировка на клиенте
      if (sort.field && sort.order && sort.order !== 'none') {
        const fieldToSort = SORT_FIELDS?.[sort.field] || sort.field;
        const orderMultiplier = sort.order === 'asc' ? 1 : -1;
        
        items = [...items].sort((a, b) => {
          let valA = a[fieldToSort];
          let valB = b[fieldToSort];

          // Поддержка вложенных полей (например, 'company.name' или 'address.city')
          if (typeof fieldToSort === 'string' && fieldToSort.includes('.')) {
            valA = fieldToSort.split('.').reduce((obj, key) => obj?.[key], a);
            valB = fieldToSort.split('.').reduce((obj, key) => obj?.[key], b);
          }

          if (typeof valA === 'string' && typeof valB === 'string') {
            return valA.localeCompare(valB) * orderMultiplier;
          }
          return (Number(valA) - Number(valB)) * orderMultiplier;
        });
      }

      // пагинация(тоже на клиенте)
      const totalFiltered = items.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedItems = items.slice(startIndex, endIndex);

      setUsers(paginatedItems);
      setTotal(totalFiltered); // Теперь total корректно отражает количество отфильтрованных записей
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  load();
  return () => controller.abort();
}, [sort.field, sort.order, page, limit, qName, qPhone, gender, minAge, maxAge]);
  function toggleSort(fieldKey) {
    setPage(1);
    setSort((prev) => {
      if (prev.field !== fieldKey) return { field: fieldKey, order: 'asc' };
      if (prev.order === 'asc') return { field: fieldKey, order: 'desc' };
      return { field: null, order: 'none' };
    });
  }

  function startResize(e, key) {
    resizing.current = { key, startX: e.clientX, startWidth: colWidths[key] };
    e.preventDefault();
  }
  // Открытие модального окна с информацией о пользователе
  async function openUserModal(id) {
    setModalError(null);
    setModalLoading(true);
    try {
      const res = await fetch(`https://dummyjson.com/users/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSelectedUser(data);
    } catch (err) {
      setModalError(err.message || String(err));
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() {
    setSelectedUser(null);
    setModalError(null);
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="users-table-container">
      <div className="table-controls">
        <div className="filters">
          <input placeholder="Поиск ФИО" value={qName} onChange={(e) => { setQName(e.target.value); setPage(1); }} />
          <input placeholder="Поиск телефона" value={qPhone} onChange={(e) => { setQPhone(e.target.value); setPage(1); }} />
          <select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }}>
            <option value="">Любой пол</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
          <input type="number" placeholder="Мин возраст" value={minAge} onChange={(e) => { setMinAge(e.target.value); setPage(1); }} min="0" />
          <input type="number" placeholder="Макс возраст" value={maxAge} onChange={(e) => { setMaxAge(e.target.value); setPage(1); }} min="0" />
        </div>

        <div className="pagination-controls">
          <label>На странице:
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <div className="paginator">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
            <span> {page} / {totalPages} </span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
          </div>
        </div>
      </div>

      {loading && <div>Загрузка...</div>}
      {error && <div className="error">Ошибка: {error}</div>}

      <div className="table-wrap" ref={tableRef}>
        <table className="users-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key}
                    className={col.key === 'fio' || col.key === 'age' || col.key === 'gender' || col.key === 'phone' ? 'sortable' : ''}
                    onClick={() => (col.key === 'fio' || col.key === 'age' || col.key === 'gender' || col.key === 'phone') && toggleSort(col.key)}
                    style={{ width: colWidths[col.key] }}
                >
                  <div className="th-content">
                    {col.label}
                    {(col.key === 'fio' || col.key === 'age' || col.key === 'gender' || col.key === 'phone') && (
                      <span className="sort-ind"><SortIndicator state={sort.field === col.key ? sort.order : 'none'} /></span>
                    )}
                  </div>
                  <div className="th-resizer" onMouseDown={(e) => startResize(e, col.key)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} onClick={() => openUserModal(u.id)} style={{ cursor: 'pointer' }}>
                <td style={{ width: colWidths.fio }}>{u.lastName || ''} {u.firstName || ''} {u.maidenName || ''}</td>
                <td style={{ width: colWidths.age }}>{u.age ?? ''}</td>
                <td style={{ width: colWidths.gender }}>{u.gender ?? ''}</td>
                <td style={{ width: colWidths.phone }}>{u.phone ?? ''}</td>
                <td style={{ width: colWidths.email }}>{u.email ?? ''}</td>
                <td style={{ width: colWidths.country }}>{u.address?.country ?? ''}</td>
                <td style={{ width: colWidths.city }}>{u.address?.city ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-controls bottom-pagination" style={{ marginTop: 12, justifyContent: 'center' }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span style={{ margin: '0 12px' }}> {page} / {totalPages} </span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
      </div>

      {/* Modal */}
      {selectedUser && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {modalLoading && <div>Загрузка...</div>}
            {modalError && <div className="error">Ошибка: {modalError}</div>}
            {!modalLoading && !modalError && (
              <div className="modal-body">
                <div className="modal-header">
                  <h2>{selectedUser.lastName} {selectedUser.firstName} {selectedUser.maidenName}</h2>
                  <button onClick={closeModal}>Закрыть</button>
                </div>
                <div className="modal-grid">
                  <div className="avatar-wrap">
                    <img src={selectedUser.image} alt="avatar" />
                  </div>
                  <div>
                    <p><strong>Возраст:</strong> {selectedUser.age}</p>
                    <p><strong>Телефон:</strong> {selectedUser.phone}</p>
                    <p><strong>Email:</strong> {selectedUser.email}</p>
                    <p><strong>Рост:</strong> {selectedUser.height ?? '—'}</p>
                    <p><strong>Вес:</strong> {selectedUser.weight ?? '—'}</p>
                    <p><strong>Адрес:</strong></p>
                    <p>{selectedUser.address?.address}</p>
                    <p>{selectedUser.address?.city}, {selectedUser.address?.state}, {selectedUser.address?.country}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
