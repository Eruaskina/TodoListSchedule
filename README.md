# Dizin — Görevler (Todo) ve Know-How Bilgi Bankası

Tamamen tarayıcı taraflı (client-side) çalışan, harici bir veritabanı gerektirmeyen, **IndexedDB** tabanlı modern Türkçe görev yöneticisi ve ilişkili bilgi bankası uygulaması.

## Öne Çıkan Özellikler

- **Görevler (Todo):** Hızlı görev ekleme, öncelik (`Düşük`, `Orta`, `Yüksek`), durum (`Yapılacak`, `Devam Ediyor`, `Tamamlandı`), tarihli ve saatlik son tarih (deadline), saatlik hatırlatmalar, etiketleme, serbest Markdown not alanı ve bağlı Know-How kayıtlarını görevi terk etmeden önizleme.
- **Otomatik Hatırlatıcı:** Uygulama açıldığında (son tarih girilmiş olsun ya da olmasın) aktif görevleri ve gecikmiş/yaklaşan saatlik son tarihleri otomatik bildirim olarak gösterir; açık kaldığı sürece saatlik hatırlatmaları tetikler.
- **Know-How (Bilgi Bankası):** Klasör / kategori bazlı kenar menüsü, Markdown editörü, canlı önizleme / bölünmüş görünüm, `[[` yazıldığında açılan otomatik kayıt bağlama menüsü, "İlişkili Kayıt Ekle" seçicisi, **Geri Bağlantılar (Backlinks)** ve **Bağlı Görevler** takibi.
- **Görsel Yönetimi:** Dosya seçme, sürükle-bırak ve `Ctrl+V` (panodan yapıştırma) ile çoklu görsel ekleme; kaydetmeden önce maksimum `1600px` boyutuna otomatik optimizasyon; tam ekran **Lightbox** görüntüleyici.
- **IndexedDB & JSON Yedekleme:** `localStorage` 5 MB sınırına takılmadan tüm görevler, dokümanlar ve görseller tarayıcıdaki IndexedDB'de saklanır; tek bir `.json` dosyası olarak dışa/içe aktarılabilir.

## Docker ile Kurulum ve Çalıştırma (GitHub Container Registry)

`docker-compose.yml`, imajı doğrudan **`ghcr.io/eruaskina/todolistschedule:latest`** adresinden çekecek şekilde yapılandırılmıştır. Herhangi bir veritabanı sunucusu gerektirmez.

### 1. İmajı GitHub Üzerinde Yayınlayın

Proje dosyalarını `https://github.com/Eruaskina/TodoListSchedule` reposuna gönderdiğinizde `.github/workflows/docker-publish.yml` iş akışı otomatik çalışır ve imajı `ghcr.io/eruaskina/todolistschedule:latest` adresine yükler.

> **Önemli:** GitHub paketinizin (`Packages -> todolistschedule -> Package settings`) görünürlüğünü **Public** yaparsanız sunucuda giriş yapmadan çekebilirsiniz. Paket **Private** ise sunucunuzda önce `echo <GITHUB_PAT> | docker login ghcr.io -u Eruaskina --password-stdin` ile oturum açmanız gerekir.

### 2. Konteyneri Başlatın

Sunucunuzda `docker-compose.yml` dosyasının bulunduğu dizinde şu komutu çalıştırın:

```bash
docker compose pull
docker compose up -d
```

### 3. Uygulamaya Erişin

Tarayıcınızdan aşağıdaki adresi açın:

```text
http://localhost:3000
```

> Farklı bir port kullanmak isterseniz `docker-compose.yml` içindeki `"3000:80"` satırını örneğin `"8080:80"` olarak güncelleyebilirsiniz.

### 4. Yararlı Docker Komutları

```bash
# Güncel imajı çek ve konteyneri yenile
docker compose pull && docker compose up -d

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
