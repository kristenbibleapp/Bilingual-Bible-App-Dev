let currentBook = 'Genesis';
let currentChapter = '1';
let currentVerse = null;
let fontSize = 1;
let isDarkMode = false;

const chapterCounts = {
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34,
  "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24,
  "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36,
  "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42, "Psalms": 150,
  "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66,
  "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12,
  "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4,
  "Micah": 7, "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3,
  "Haggai": 2, "Zechariah": 14, "Malachi": 4,
  "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28,
  "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6,
  "Ephesians": 6, "Philippians": 4, "Colossians": 4, "1 Thessalonians": 5,
  "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4, "Titus": 3,
  "Philemon": 1, "Hebrews": 13, "James": 5, "1 Peter": 5, "2 Peter": 3,
  "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22
};

document.addEventListener('DOMContentLoaded', () => {
  const bookPicker = document.getElementById('bookPicker');
  const chapterPicker = document.getElementById('chapterPicker');
  const versePicker = document.getElementById('versePicker');
  const fontSelect = document.getElementById('fontSelect');
  const verseTable = document.getElementById('verseTable');

  bookPicker.addEventListener('change', () => {
    currentBook = bookPicker.value;
    currentChapter = '1';
    populateChapters();
    loadChapter();
  });
  
  let touchStartX = null;

  document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });

  document.addEventListener('touchend', e => {
    if (touchStartX === null) return;

    const touchEndX = e.changedTouches[0].screenX;
    const deltaX = touchEndX - touchStartX;

    if (Math.abs(deltaX) > 50) {
      const direction = deltaX > 0 ? 'left' : 'right';
      changeChapter(direction);
    }

    touchStartX = null;
  });

  function changeChapter(direction) {
    const chapterPicker = document.getElementById('chapterPicker');
    const chapters = Array.from(chapterPicker.options).map(opt => opt.value);
    const currentIndex = chapters.indexOf(currentChapter);

    let newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= chapters.length) return;

    currentChapter = chapters[newIndex];
    chapterPicker.value = currentChapter;
    loadChapter();
  }
  
  chapterPicker.addEventListener('change', () => {
    currentChapter = chapterPicker.value;
    loadChapter();
  });

  versePicker.addEventListener('change', () => {
    currentVerse = versePicker.value;
    scrollToVerse(currentVerse);
  });

  document.getElementById('increaseFont').addEventListener('click', () => {
    fontSize += 0.1;
    verseTable.style.fontSize = fontSize + 'rem';
  });

  document.getElementById('decreaseFont').addEventListener('click', () => {
    fontSize = Math.max(0.5, fontSize - 0.1);
    verseTable.style.fontSize = fontSize + 'rem';
  });

  fontSelect.addEventListener('change', () => {
    verseTable.style.fontFamily = fontSelect.value;
  });

  document.getElementById('toggleDarkMode').addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark', isDarkMode);
  });

  populateChapters();
  loadChapter();
});

function populateChapters() {
  const chapterPicker = document.getElementById('chapterPicker');
  chapterPicker.innerHTML = '';
  const chapters = chapterCounts[currentBook] || 1;
  for (let i = 1; i <= chapters; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Chapter ${i}`;
    chapterPicker.appendChild(option);
  }
  chapterPicker.value = currentChapter;
}

function loadChapter() {
  const leftPath = `/bible/kjv/${currentBook}/${currentChapter.padStart(2, '0')}.json`;
  const rightPath = `/bible/rvr/${currentBook}/${currentChapter.padStart(2, '0')}.json`;

  Promise.all([fetch(leftPath), fetch(rightPath)])
    .then(responses => Promise.all(responses.map(r => r.json())))
    .then(([kjvData, rvrData]) => {
      const verseTable = document.getElementById('verseTable');
      verseTable.innerHTML = '';
      const maxVerses = Math.max(Object.keys(kjvData).length, Object.keys(rvrData).length);

      const versePicker = document.getElementById('versePicker');
      versePicker.innerHTML = '';
      for (let i = 1; i <= maxVerses; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Verse ${i}`;
        versePicker.appendChild(option);
      }

      for (let i = 1; i <= maxVerses; i++) {
        const row = document.createElement('div');
        row.className = 'verse-row';
        row.dataset.verse = i;

        const leftCell = document.createElement('div');
        leftCell.className = 'verse-cell left';
        leftCell.textContent = `${i}. ${kjvData[i] || ''}`;

        const rightCell = document.createElement('div');
        rightCell.className = 'verse-cell right';
        rightCell.textContent = `${i}. ${rvrData[i] || ''}`;

        row.appendChild(leftCell);
        row.appendChild(rightCell);

        row.addEventListener('click', () => highlightVerse(i));

        verseTable.appendChild(row);
      }
    })
    .catch(err => {
      console.error('Error loading chapter:', err);
      document.getElementById('verseTable').innerHTML = '<p style="color:red;">❌ Error loading scripture.</p>';
    });
}

function scrollToVerse(verse) {
  const row = document.querySelector(`.verse-row[data-verse="${verse}"]`);
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightVerse(verse);
  }
}

function highlightVerse(verse) {
  document.querySelectorAll('.verse-row').forEach(row => {
    row.classList.remove('highlight');
  });
  const target = document.querySelector(`.verse-row[data-verse="${verse}"]`);
  if (target) {
    target.classList.add('highlight');
  }
}
