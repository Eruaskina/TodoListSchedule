import {
  ExportedImage,
  KnowHowItem,
  StoredImage,
  TodoItem,
  TodoPriority,
  TodoStatus,
  WorkspaceExport,
} from '../types';
import {blobToDataUrl, dataUrlToBlob} from '../utils/imageOptimizer';

const DB_NAME = 'dizin_workspace_db';
const DB_VERSION = 1;

const STORE_TODOS = 'todos';
const STORE_KNOWHOWS = 'knowhows';
const STORE_IMAGES = 'images';
const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TODOS)) {
        db.createObjectStore(STORE_TODOS, {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains(STORE_KNOWHOWS)) {
        db.createObjectStore(STORE_KNOWHOWS, {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, {keyPath: 'key'});
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('IndexedDB açılamadı.'));
    };
  });

  return dbPromise;
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

function getOneFromStore<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function putInStore<T>(db: IDBDatabase, storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function deleteFromStore(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Extracts all [[Title]] wiki-link targets from markdown text.
 */
export function extractWikiLinkTitles(markdown: string): string[] {
  const regex = /\[\[([^[\]]+)\]\]/g;
  const titles: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const cleaned = match[1].trim();
    if (cleaned && !titles.includes(cleaned)) {
      titles.push(cleaned);
    }
  }
  return titles;
}

export async function initializeAndLoadWorkspace(): Promise<{
  todos: TodoItem[];
  knowhows: KnowHowItem[];
  images: StoredImage[];
  folders: string[];
}> {
  const db = await openDatabase();
  const seededMeta = await getOneFromStore<{key: string; value: boolean}>(db, STORE_META, 'seeded');

  if (!seededMeta?.value) {
    const now = Date.now();
    const kh1Id = 'kh_docker_dagitim';
    const kh2Id = 'kh_yedekleme_stratejisi';

    const seedKnowHows: KnowHowItem[] = [
      {
        id: kh1Id,
        title: 'Docker ile Uygulama Dağıtım Rehberi',
        category: 'DevOps',
        tags: ['docker', 'devops', 'dağıtım'],
        relatedKnowHowIds: [kh2Id],
        imageIds: [],
        createdAt: now - 1000 * 60 * 120,
        updatedAt: now - 1000 * 60 * 45,
        content: `## Genel Bakış

Bu doküman, uygulamanın tamamen tarayıcı taraflı (IndexedDB) olarak Docker üzerinde nasıl ayağa kaldırılacağını özetler. Harici bir veritabanı sunucusuna ihtiyaç yoktur.

### Kurulum Adımları

- [x] Çok aşamalı \`Dockerfile\` ile üretim derlemesini (\`npm run build\`) oluştur
- [x] Nginx ile tek sayfa uygulama (SPA) yönlendirmesini yapılandır
- [ ] \`docker compose up -d --build\` komutu ile konteyneri başlat

\`\`\`bash
# İmajı derle ve arka planda başlat
docker compose up -d --build
\`\`\`

### Dikkat Edilecekler

Veriler kullanıcının kendi tarayıcısındaki **IndexedDB** alanında tutulduğu için farklı cihazlara geçiş yaparken [[Yedekleme ve Veri Taşıma Stratejisi]] dokümanındaki adımları izlemelisin.`,
      },
      {
        id: kh2Id,
        title: 'Yedekleme ve Veri Taşıma Stratejisi',
        category: 'Veri Yönetimi',
        tags: ['veri', 'yedekleme', 'indexeddb'],
        relatedKnowHowIds: [kh1Id],
        imageIds: [],
        createdAt: now - 1000 * 60 * 90,
        updatedAt: now - 1000 * 60 * 30,
        content: `## Neden IndexedDB?

Tarayıcı \`localStorage\` alanı yaklaşık **5 MB** ile sınırlıdır. Know-How kayıtlarına eklenen ekran görüntüleri ve diyagramlar için bu sınır hızla dolar. **IndexedDB**, yüzlerce megabayt görsel ve metin verisini tarayıcı içinde güvenle saklar.

### Yedek Alma ve Geri Yükleme

1. Sol menünün alt kısmındaki **Yedekle / Geri Yükle (JSON)** düğmesine tıkla.
2. **JSON Olarak Dışa Aktar** seçeneği tüm görevleri, Know-How dokümanlarını ve optimize edilmiş görselleri tek bir \`.json\` dosyasında paketler.
3. Yeni bir tarayıcıya veya sunucuya geçtiğinde aynı menüden dosyayı içe aktarabilirsin.

> İpucu: Sunucu kurulumu için [[Docker ile Uygulama Dağıtım Rehberi]] kaydını inceleyebilirsin.`,
      },
    ];

    const seedTodos: TodoItem[] = [
      {
        id: 'todo_docker_test',
        title: 'Docker Compose dosyasını sunucuda test et',
        completed: false,
        status: TodoStatus.IN_PROGRESS,
        priority: TodoPriority.HIGH,
        tags: ['docker', 'kurulum'],
        notes: `### Kontrol Listesi
- [x] Port 3000 yönlendirmesini doğrula
- [ ] İlk açılışta IndexedDB örnek kayıtlarının geldiğini gör
- [ ] Görsel yapıştırma (\`Ctrl+V\`) performansını kontrol et`,
        linkedKnowHowIds: [kh1Id],
        deadline: now + 1000 * 60 * 90,
        hourlyReminder: true,
        createdAt: now - 1000 * 60 * 60,
        updatedAt: now - 1000 * 60 * 20,
      },
      {
        id: 'todo_json_yedek',
        title: 'Haftalık JSON veritabanı yedeğini indir',
        completed: false,
        status: TodoStatus.TODO,
        priority: TodoPriority.MEDIUM,
        tags: ['yedekleme', 'bakım'],
        notes: `Cuma günleri düzenli olarak tam JSON yedeği alınıp güvenli klasöre arşivlenecek.`,
        linkedKnowHowIds: [kh2Id],
        deadline: null,
        hourlyReminder: false,
        createdAt: now - 1000 * 60 * 40,
        updatedAt: now - 1000 * 60 * 10,
      },
    ];

    const seedFolders = ['DevOps', 'Veri Yönetimi'];

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_KNOWHOWS, STORE_TODOS, STORE_META], 'readwrite');
      const khStore = tx.objectStore(STORE_KNOWHOWS);
      const todoStore = tx.objectStore(STORE_TODOS);
      const metaStore = tx.objectStore(STORE_META);

      for (const kh of seedKnowHows) khStore.put(kh);
      for (const todo of seedTodos) todoStore.put(todo);
      metaStore.put({key: 'seeded', value: true});
      metaStore.put({key: 'knowhow_folders', value: seedFolders});

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  const [todos, knowhows, images, foldersMeta] = await Promise.all([
    getAllFromStore<TodoItem>(db, STORE_TODOS),
    getAllFromStore<KnowHowItem>(db, STORE_KNOWHOWS),
    getAllFromStore<StoredImage>(db, STORE_IMAGES),
    getOneFromStore<{key: string; value: string[]}>(db, STORE_META, 'knowhow_folders'),
  ]);

  todos.sort((a, b) => b.updatedAt - a.updatedAt);
  knowhows.sort((a, b) => b.updatedAt - a.updatedAt);

  const folderSet = new Set<string>(foldersMeta?.value ?? []);
  for (const kh of knowhows) {
    const cat = (kh.category ?? '').trim();
    if (cat) folderSet.add(cat);
  }

  return {
    todos,
    knowhows,
    images,
    folders: Array.from(folderSet).sort((a, b) => a.localeCompare(b, 'tr-TR')),
  };
}

export async function saveFolders(folders: string[]): Promise<void> {
  const db = await openDatabase();
  const unique = Array.from(new Set(folders.map((f) => f.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'tr-TR')
  );
  await putInStore(db, STORE_META, {key: 'knowhow_folders', value: unique});
}

export async function saveTodo(todo: TodoItem): Promise<void> {
  const db = await openDatabase();
  await putInStore(db, STORE_TODOS, todo);
}

export async function removeTodo(id: string): Promise<void> {
  const db = await openDatabase();
  await deleteFromStore(db, STORE_TODOS, id);
}

export async function saveKnowHow(knowhow: KnowHowItem): Promise<void> {
  const db = await openDatabase();
  await putInStore(db, STORE_KNOWHOWS, knowhow);
}

export async function removeKnowHow(id: string): Promise<void> {
  const db = await openDatabase();
  await deleteFromStore(db, STORE_KNOWHOWS, id);
}

export async function saveImage(image: StoredImage): Promise<void> {
  const db = await openDatabase();
  await putInStore(db, STORE_IMAGES, image);
}

export async function removeImage(id: string): Promise<void> {
  const db = await openDatabase();
  await deleteFromStore(db, STORE_IMAGES, id);
}

export async function exportWorkspaceToJson(): Promise<WorkspaceExport> {
  const db = await openDatabase();
  const [todos, knowhows, images, foldersMeta] = await Promise.all([
    getAllFromStore<TodoItem>(db, STORE_TODOS),
    getAllFromStore<KnowHowItem>(db, STORE_KNOWHOWS),
    getAllFromStore<StoredImage>(db, STORE_IMAGES),
    getOneFromStore<{key: string; value: string[]}>(db, STORE_META, 'knowhow_folders'),
  ]);

  const exportedImages: ExportedImage[] = await Promise.all(
    images.map(async (img) => ({
      id: img.id,
      name: img.name,
      mimeType: img.mimeType,
      width: img.width,
      height: img.height,
      size: img.size,
      dataUrl: await blobToDataUrl(img.blob),
      createdAt: img.createdAt,
    }))
  );

  const folderSet = new Set<string>(foldersMeta?.value ?? []);
  for (const kh of knowhows) {
    if (kh.category?.trim()) folderSet.add(kh.category.trim());
  }

  return {
    app: 'dizin-workspace',
    version: 2,
    exportedAt: new Date().toISOString(),
    todos,
    knowhows,
    images: exportedImages,
    folders: Array.from(folderSet).sort((a, b) => a.localeCompare(b, 'tr-TR')),
  };
}

export async function importWorkspaceFromJson(
  payload: WorkspaceExport
): Promise<{todos: TodoItem[]; knowhows: KnowHowItem[]; images: StoredImage[]; folders: string[]}> {
  if (
    !payload ||
    !Array.isArray(payload.todos) ||
    !Array.isArray(payload.knowhows) ||
    !Array.isArray(payload.images)
  ) {
    throw new Error('Geçersiz yedek dosyası biçimi.');
  }

  const restoredImages: StoredImage[] = await Promise.all(
    payload.images.map(async (img) => {
      const blob = await dataUrlToBlob(img.dataUrl);
      return {
        id: img.id,
        name: img.name,
        mimeType: img.mimeType || blob.type || 'image/webp',
        width: img.width || 0,
        height: img.height || 0,
        size: img.size || blob.size,
        blob,
        createdAt: img.createdAt || Date.now(),
      };
    })
  );

  const folderSet = new Set<string>(Array.isArray(payload.folders) ? payload.folders : []);
  for (const kh of payload.knowhows) {
    if (kh.category?.trim()) folderSet.add(kh.category.trim());
  }
  const folders = Array.from(folderSet).sort((a, b) => a.localeCompare(b, 'tr-TR'));

  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_TODOS, STORE_KNOWHOWS, STORE_IMAGES, STORE_META], 'readwrite');
    const todoStore = tx.objectStore(STORE_TODOS);
    const khStore = tx.objectStore(STORE_KNOWHOWS);
    const imgStore = tx.objectStore(STORE_IMAGES);
    const metaStore = tx.objectStore(STORE_META);

    todoStore.clear();
    khStore.clear();
    imgStore.clear();

    for (const todo of payload.todos) todoStore.put(todo);
    for (const kh of payload.knowhows) khStore.put(kh);
    for (const img of restoredImages) imgStore.put(img);
    metaStore.put({key: 'seeded', value: true});
    metaStore.put({key: 'knowhow_folders', value: folders});

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('İçe aktarma başarısız oldu.'));
  });

  const sortedTodos = [...payload.todos].sort((a, b) => b.updatedAt - a.updatedAt);
  const sortedKnowHows = [...payload.knowhows].sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    todos: sortedTodos,
    knowhows: sortedKnowHows,
    images: restoredImages,
    folders,
  };
}
