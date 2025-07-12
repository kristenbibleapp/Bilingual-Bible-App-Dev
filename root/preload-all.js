function preloadBibleFiles() {
  return new Promise(async (resolve) => {
    const books = {
      "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34,
      "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24,
      "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36,
      "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42, "Psalms": 150,
      "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66,
      "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12, "Hosea": 14,
      "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7,
      "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14,
      "Malachi": 4, "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21,
      "Acts": 28, "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13,
      "Galatians": 6, "Ephesians": 6, "Philippians": 4, "Colossians": 4,
      "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4,
      "Titus": 3, "Philemon": 1, "Hebrews": 13, "James": 5, "1 Peter": 5,
      "2 Peter": 3, "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1,
      "Revelation": 22
    };
    const versions = ['kjv', 'rvr'];
    const failedFiles = [];
    let loadedFiles = 0;

    const progressBox = document.createElement('div');
    progressBox.id = 'preloadProgress';
    progressBox.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #003cf5;
      color: white;
      padding: 10px 15px;
      border-radius: 6px;
      font-family: sans-serif;
      z-index: 10000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(progressBox);

    const shellFiles = [
      './', '/index.html', '/app.js', '/style-kristen.css',
      '/manifest.json', 
    ];

    for (const file of shellFiles) {
      try {
        const response = await fetch(file);
        if (response.ok) {
          const cache = await caches.open('bilingual-bible-cache-v1');
          await cache.put(file, response.clone());
        }
      } catch (err) {
        console.warn(`❌ Failed to cache shell file: ${file}`, err);
      }
    }

    const bibleFiles = [];
    for (const version of versions) {
      for (const [book, chapters] of Object.entries(books)) {
        for (let i = 1; i <= chapters; i++) {
          const filePath = `/bible/${version}/${book}/${i.toString().padStart(2, '0')}.json`;
          bibleFiles.push(filePath);
        }
      }
    }

    const totalFiles = bibleFiles.length;

    async function tryCache(filePath) {
      try {
        const response = await fetch(filePath);
        if (response.ok) {
          const cache = await caches.open('bilingual-bible-cache-v1');
          await cache.put(filePath, response.clone());
          return true;
        }
      } catch (err) {}
      return false;
    }

    for (const filePath of bibleFiles) {
      const success = await tryCache(filePath);
      if (success) {
        loadedFiles++;
        const percent = ((loadedFiles / totalFiles) * 100).toFixed(1);
        progressBox.textContent = `📖 Caching: ${loadedFiles} / ${totalFiles} files (${percent}%)`;
      } else {
        failedFiles.push(filePath);
      }
    }

    for (let attempt = 1; attempt <= 2 && failedFiles.length > 0; attempt++) {
      const retryList = [...failedFiles];
      failedFiles.length = 0;
      for (const filePath of retryList) {
        const success = await tryCache(filePath);
        if (success) {
          loadedFiles++;
          const percent = ((loadedFiles / totalFiles) * 100).toFixed(1);
          progressBox.textContent = `📖 Retrying: ${loadedFiles} / ${totalFiles} files (${percent}%)`;
        } else {
          failedFiles.push(filePath);
        }
      }
    }

    progressBox.textContent = `✅ Finished: ${loadedFiles} of ${totalFiles} files cached.`;
    if (failedFiles.length > 0) {
      console.warn(`⚠️ ${failedFiles.length} files failed after retries:`, failedFiles);
    }

    setTimeout(() => progressBox.remove(), 4000);
    resolve();
  });
}
