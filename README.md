# Dizin — Görevler (Todo) ve Know-How Bilgi Bankası

Tamamen tarayıcı taraflı (client-side) çalışan, harici bir veritabanı gerektirmeyen, **IndexedDB** tabanlı modern Türkçe görev yöneticisi ve ilişkili bilgi bankası uygulaması.

## Öne Çıkan Özellikler

- **Görevler (Todo):** Hızlı görev ekleme, öncelik (`Düşük`, `Orta`, `Yüksek`), durum (`Yapılacak`, `Devam Ediyor`, `Tamamlandı`), etiketleme, serbest Markdown not alanı ve bağlı Know-How kayıtlarını görevi terk etmeden önizleme.
- **Know-How (Bilgi Bankası):** Markdown editörü, canlı önizleme / bölünmüş görünüm, `[[` yazıldığında açılan otomatik kayıt bağlama menüsü, "İlişkili Kayıt Ekle" seçicisi, **Geri Bağlantılar (Backlinks)** ve **Bağlı Görevler** takibi.
- **Görsel Yönetimi:** Dosya seçme, sürükle-bırak ve `Ctrl+V` (panodan yapıştırma) ile çoklu görsel ekleme; kaydetmeden önce maksimum `1600px` boyutuna otomatik optimizasyon; tam ekran **Lightbox** görüntüleyici.
- **IndexedDB & JSON Yedekleme:** `localStorage` 5 MB sınırına takılmadan tüm görevler, dokümanlar ve görseller tarayıcıdaki IndexedDB'de saklanır; tek bir `.json` dosyası olarak dışa/içe aktarılabilir.

## Docker ile Kurulum ve Çalıştırma

Uygulama herhangi bir veritabanı sunucusu gerektirmez. Çok aşamalı `Dockerfile` ile derlenip `nginx:alpine` üzerinden sunulur.

### 1. İmajı Derleyin ve Başlatın

Proje kök dizininde aşağıdaki komutu çalıştırın:

```bash
docker compose up -d --build
```

### 2. Uygulamaya Erişin

Tarayıcınızdan aşağıdaki adresi açın:

```text
http://localhost:3000
```

> Farklı bir port kullanmak isterseniz `docker-compose.yml` içindeki `"3000:80"` satırını örneğin `"8080:80"` olarak güncelleyebilirsiniz.

### 3. Yararlı Docker Komutları

```bash
# Konteyner durumunu görüntüle
docker compose ps

# Logları izle
docker compose logs -f dizin-app

# Uygulamayı durdur
docker compose down
```

## Yerel Geliştirme (Docker Olmadan)

```bash
npm install
npm run dev
```
