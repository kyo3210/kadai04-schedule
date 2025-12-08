// Firebase 
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    Timestamp,
    doc,        
    getDoc,     
    updateDoc,  
    deleteDoc   
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebaseの設定
const firebaseConfig = {
    apiKey: "AIzaSyDeNEACWvVx4T__S_7l6QQjNHnXdJcVrAI",
    authDomain: "family-schedule-kadai04.firebaseapp.com",
    projectId: "family-schedule-kadai04",
    storageBucket: "family-schedule-kadai04.firebasestorage.app",
    messagingSenderId: "236968973684",
    appId: "1:236968973684:web:fa885e319812daeb02c821"
};

// Firebaseの初期化とFirestoreの取得
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Firestoreコレクションへの参照
const usersRef = collection(db, "users");
const schedulesRef = collection(db, "schedules");

let cachedUsers = {};
let calendar = null; 

// ---------------------------------------------
// データ同期 (リアルタイム監視)
// ---------------------------------------------
const startDataSynchronization = () => {
    onSnapshot(usersRef, (snapshot) => {
        cachedUsers = {};
        const usersArray = snapshot.docs.map(doc => {
            cachedUsers[doc.id] = doc.data();
            return { id: doc.id, ...doc.data() };
        });
        updateUsersDropdown(usersArray);
        renderSchedules();
    }, (error) => {
        console.error("ユーザー情報の取得エラー: ", error);
    });

    const scheduleQuery = query(schedulesRef, orderBy('start', 'asc'));
    onSnapshot(scheduleQuery, (snapshot) => {
        renderSchedules(snapshot.docs);
    }, (error) => {
        console.error("スケジュール情報の取得エラー: ", error);
    });
}


// ---------------------------------------------
// ユーザー管理関数
// ---------------------------------------------
const handleAddUser = async (e) => {
    e.preventDefault(); 
    const name = document.getElementById('userName').value;
    const color = document.getElementById('userColor').value;
    try {
        await addDoc(usersRef, { name: name, color: color });
        alert(`ユーザー "${name}" を追加しました。`);
        document.getElementById('addUserForm').reset();
    } catch (error) {
        console.error("ユーザー追加エラー: ", error);
        alert("ユーザーの追加に失敗しました。");
    }
};

const updateUsersDropdown = (users) => {
    const select = document.getElementById('scheduleUserId');
    if (!select) return;
    select.innerHTML = '<option value="">-- ユーザーを選択 --</option>'; 
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        select.appendChild(option);
    });
};


// ---------------------------------------------
// スケジュール管理関数 (追加/編集/削除)
// ---------------------------------------------

/** Dateオブジェクトを YYYY-MM-DD 形式の文字列に変換する */
const dateToYMD = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/** DateオブジェクトをISO形式（YYYY-MM-DDTHH:mm）に変換する */
const dateToLocalISO = (date) => {
    if (!date) return '';
    // Dateオブジェクトをローカルタイムゾーンに基づいてISO文字列（YYYY-MM-DDTHH:mm）に変換
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
};


const handleAddSchedule = async (e) => {
    e.preventDefault();
    const userId = document.getElementById('scheduleUserId').value;
    const title = document.getElementById('scheduleTitle').value;
    const startValue = document.getElementById('scheduleStart').value;
    const endValueElement = document.getElementById('scheduleEnd');
    const endValue = endValueElement ? endValueElement.value : ''; 
    const allDayToggle = document.getElementById('allDayToggle');
    const isAllDay = allDayToggle ? allDayToggle.checked : false;

    if (!userId || !startValue) {
        alert("ユーザー選択と開始日時／開始日は必須です。");
        return;
    }

    try {
        const scheduleData = { userId: userId, title: title };
        
        if (isAllDay) {
            scheduleData.start = startValue; 
            scheduleData.isAllDay = true;
            
            if (endValue) {
                //  終了日を1日加算して保存
                const endDate = new Date(endValue);
                endDate.setDate(endDate.getDate() + 1); 
                scheduleData.end = dateToYMD(endDate); 
            }
        } else {
            const start = new Date(startValue); 
            scheduleData.start = Timestamp.fromDate(start);
            scheduleData.isAllDay = false;
            
            if (endValue) {
                const end = new Date(endValue);
                scheduleData.end = Timestamp.fromDate(end);
            }
        }
        await addDoc(schedulesRef, scheduleData);
        alert(`スケジュール "${title}" を追加しました。`);
        document.getElementById('addScheduleForm').reset();
    } catch (error) {
        console.error("スケジュール追加エラー: ", error);
        alert("スケジュールの追加に失敗しました。");
    }
};

const setupEditModalListeners = () => {
    const editModal = document.getElementById('editModal');
    if (!editModal) return; 

    document.getElementById('closeModalButton').addEventListener('click', () => {
        editModal.style.display = 'none';
    });
    
    document.getElementById('deleteButton').addEventListener('click', async () => {
        if (confirm("この予定を削除してもよろしいですか？")) {
            const id = document.getElementById('editScheduleId').value;
            await deleteSchedule(id);
            editModal.style.display = 'none';
        }
    });

    document.getElementById('editScheduleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editScheduleId').value;
        const newTitle = document.getElementById('editTitle').value.trim();
        const newStartISO = document.getElementById('editStart').value;
        const newEndISO = document.getElementById('editEnd').value;
        
        if (newTitle === '') {
            alert("タイトルは必須です。");
            return;
        }

        const updates = { title: newTitle };
        const isAllDayEdit = document.getElementById('editStart').type === 'date';

        if (isAllDayEdit) {
             updates.start = newStartISO;
             updates.isAllDay = true;
             
             //  終了日を1日加算して保存
             if (newEndISO) {
                 const endDate = new Date(newEndISO);
                 endDate.setDate(endDate.getDate() + 1);
                 updates.end = dateToYMD(endDate);
             } else {
                 updates.end = null;
             }

        } else {
             const newStartDate = new Date(newStartISO);
             updates.start = Timestamp.fromDate(newStartDate);
             updates.isAllDay = false;

             if (newEndISO) {
                  updates.end = Timestamp.fromDate(new Date(newEndISO));
             } else {
                  updates.end = null;
             }
        }

        await updateSchedule(id, updates);
        editModal.style.display = 'none';
    });
};


const openEditModal = async (scheduleId) => {
    const editModal = document.getElementById('editModal');
    if (!editModal) {
         console.error("FATAL ERROR: #editModal element not found.");
         return; 
    }
    
    // 1. Firestoreから該当の予定情報を取得
    const docRef = doc(db, "schedules", scheduleId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        alert("予定が見つかりませんでした。");
        return;
    }

    const schedule = docSnap.data();
    const isAllDay = schedule.isAllDay === true; 

    // フォーム要素の取得
    const editTitle = document.getElementById('editTitle');
    const editStart = document.getElementById('editStart');
    const editEnd = document.getElementById('editEnd');
    const editScheduleId = document.getElementById('editScheduleId');
    
    // エラー対策強化: 要素が見つからない場合は処理を中止
    if (!editTitle || !editStart || !editEnd || !editScheduleId) {
        console.error("FATAL ERROR: Edit modal input fields not found.");
        return;
    }
    
    // 1. 日時の入力タイプと値をセット
    editStart.type = isAllDay ? 'date' : 'datetime-local';
    editEnd.type = isAllDay ? 'date' : 'datetime-local';

    if (isAllDay) {
        // 終日イベントの場合: 1日加算される前の元の終了日を計算して表示
        let displayEnd = schedule.end;
        if (schedule.end) {
            const endDate = new Date(schedule.end);
            // 保存時に1日加算したので、表示用に1日減らす
            endDate.setDate(endDate.getDate() - 1); 
            displayEnd = dateToYMD(endDate);
        }

        editStart.value = schedule.start || '';
        editEnd.value = displayEnd || '';

    } else {
        // 時間ありイベントの場合: TimestampをISO形式に変換
        const startDate = schedule.start.toDate();
        const endDate = schedule.end ? schedule.end.toDate() : null;
        editStart.value = dateToLocalISO(startDate);
        editEnd.value = endDate ? dateToLocalISO(endDate) : '';
    }
    
    // 2. その他のデータをセット
    editScheduleId.value = scheduleId;
    editTitle.value = schedule.title;

    // 3. モーダルを表示
    editModal.style.display = 'block';
};

/** 予定の任意のフィールドを更新する */
const updateSchedule = async (id, updates) => {
    try {
        const scheduleDocRef = doc(db, "schedules", id); 
        await updateDoc(scheduleDocRef, updates);
        alert("予定を修正しました。");
    } catch (error) {
        console.error("スケジュールの更新エラー: ", error);
        alert("予定の修正に失敗しました。\nエラー: " + error.message);
    }
};

/** 予定を削除する */
const deleteSchedule = async (id) => {
     try {
        const scheduleDocRef = doc(db, "schedules", id); 
        await deleteDoc(scheduleDocRef);
        alert("予定を削除しました。");
    } catch (error) {
        console.error("スケジュールの削除エラー: ", error);
        alert("予定の削除に失敗しました。");
    }
};


// ---------------------------------------------
//  FullCalendarへのデータ反映
// ---------------------------------------------
const renderSchedules = (scheduleDocs = []) => {
    if (!calendar) return;

    const events = scheduleDocs.map(doc => {
        const schedule = doc.data();
        const user = cachedUsers[schedule.userId];
        const isAllDay = schedule.isAllDay === true; 
        
        let startData;
        let endData;
        
        if (isAllDay) {
            startData = schedule.start; 
            endData = schedule.end || null; // FullCalendarはここで自動で1日引く
        } else {
            startData = schedule.start ? schedule.start.toDate() : null; 
            endData = schedule.end ? schedule.end.toDate() : null; 
        }
        
        return {
            id: doc.id,
            title: `${user ? user.name : '不明'}: ${schedule.title}`,
            start: startData,
            end: endData,
            allDay: isAllDay,
            backgroundColor: user ? user.color : '#cccccc',
            borderColor: user ? user.color : '#cccccc',
            userId: schedule.userId 
        };
    });

    calendar.getEventSources().forEach(source => source.remove());
    calendar.addEventSource(events);
    calendar.refetchEvents();
};


// ---------------------------------------------
// 祝日データとハイライト処理
// ---------------------------------------------
const holidays = [
    "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20", 
    "2026-04-29", "2026-05-04", "2026-05-05", "2026-05-06", "2026-07-20", 
    "2026-08-11", "2026-09-21", "2026-09-22", "2026-10-12", "2026-11-03", 
    "2026-11-23"
];

const highlightHolidays = (startDate, endDate) => {
    document.querySelectorAll('.fc-holiday').forEach(el => {
        el.classList.remove('fc-holiday');
    });
    if (!calendar) return;
    const cells = document.querySelectorAll('.fc-daygrid-day-frame, .fc-timegrid-day');

    cells.forEach(cell => {
        const dateStr = cell.closest('.fc-day').getAttribute('data-date');
        if (dateStr && holidays.includes(dateStr)) {
            cell.closest('.fc-day').classList.add('fc-holiday');
        }
    });
};

// ---------------------------------------------
// 月ごとにカレンダーコンテナのクラスを切り替える関数
// ---------------------------------------------
const setMonthlyBackgroundColor = (currentDate) => {
    const calendarEl = document.getElementById('calendarbox'); 
    if (!calendarEl) return;
    
    calendarEl.className = calendarEl.className.replace(/month-\w+/g, '').trim(); 
    const currentMonth = currentDate.getMonth(); 
    
    let monthClass = '';
    switch (currentMonth) {
        case 0: monthClass = 'month-january'; break;
        case 1: monthClass = 'month-february'; break;
        case 2: monthClass = 'month-march'; break;
        case 3: monthClass = 'month-april'; break;
        case 4: monthClass = 'month-may'; break;
        case 5: monthClass = 'month-june'; break;
        case 6: monthClass = 'month-july'; break;
        case 7: monthClass = 'month-august'; break;
        case 8: monthClass = 'month-september'; break;
        case 9: monthClass = 'month-october'; break;
        case 10: monthClass = 'month-november'; break;
        case 11: monthClass = 'month-december'; break;
        default: return;
    }
    calendarEl.classList.add(monthClass);
};


// ---------------------------------------------
//  FullCalendar の初期化とDOM操作
// ---------------------------------------------
const setupAllDayToggle = () => {
    const toggle = document.getElementById('allDayToggle');
    const startInput = document.getElementById('scheduleStart');
    const endInput = document.getElementById('scheduleEnd');

    if (toggle && startInput && endInput) {
        toggle.addEventListener('change', () => {
            const isAllDay = toggle.checked;
            startInput.type = isAllDay ? 'date' : 'datetime-local';
            endInput.type = isAllDay ? 'date' : 'datetime-local';
            startInput.value = '';
            endInput.value = '';
            startInput.required = true; 
        });
    }
}


document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    
    if (calendarEl && typeof FullCalendar !== 'undefined') {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'ja',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            fixedWeekCount: false,
//  イベントの表示方法をブロック要素として強制
            eventDisplay: 'block', 

            // イベントの重なりを禁止
            eventOverlap: false, 

            // // dayMaxEvents: true は 'more' リンクを表示するためのもの、縦に並べたい場合はそのままでOK
            // dayMaxEvents: true,

                datesSet: function(dateInfo) {
                highlightHolidays(dateInfo.start, dateInfo.end);
                setMonthlyBackgroundColor(dateInfo.view.currentStart);
            },
            eventClick: function(info) {
                openEditModal(info.event.id); 
            },
            slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
            eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
            slotMinTime: '00:00:00',
            slotMaxTime: '24:00:00',
            dayCellClassNames: function(arg) {
                if (arg.date.getDay() === 6) { return ['fc-sat']; }
                if (arg.date.getDay() === 0) { return ['fc-sun']; }
                return [];
            },
        });
        calendar.render();
    } else {
        console.error("FullCalendarまたはカレンダー要素が見つかりません。");
    }

    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) { addUserForm.addEventListener('submit', handleAddUser); }

    const addScheduleForm = document.getElementById('addScheduleForm');
    if (addScheduleForm) { addScheduleForm.addEventListener('submit', handleAddSchedule); }
    
    setupAllDayToggle();
    setupEditModalListeners();
    startDataSynchronization();
});