# DJS-Bot Kod Tabanı Yol Gösterici Rehberi

Bu belge, projemizin (`DJS-Bot`) kod tabanının genel yapısını, ana bileşenlerini, veri akışını ve kullanılan komut/event mekanizmalarını anlamanı sağlamak için hazırlanmıştır.

## 1. Proje Amacı (Goal)

DJS-Bot, bir Discord sunucusunda kullanıcı aktivitesini (mesajlar, sesli kanallar, partner etkinlikleri) takip ederek haftalık performans skorları hesaplayan ve bu verilere dayalı olarak kullanıcıları haftalık ödüller (yetkili/üyelik rolleri) ile ödüllendiren bir yönetim botudur. Ayrıca, yöneticilere ayarları kontrol edebilecek paneller ve yönetim komutları sunmaktadır.

## 2. Temel Bileşenler ve Yapı (Core Components & Structure)

Botumuz, temel olarak üç ana katmanda çalışmaktadır:

### 2.1. Konfigürasyon Katmanı (`config.js` ve `.env`)
*   **`config.js`**: Botun tüm sabitlerini (token, kanal ID'leri, rol ID'leri, skorlama limitleri) tanımlar.
    *   **Önemli Ayarlar**:
        *   `STAFF_ROLES`: Yüksek puan alan kullanıcıları ödüllendirmek için belirlenmiş roller.
        *   `YETKILI_BOARD_KANAL_ID` / `UYE_BOARD_KANAL_ID`: Haftalık kazananların sergilendiği kanallar.
        *   `trackMessages` / `trackPartners`: Mesaj ve partner aktivitesinin skor hesabına dahil edilip edilmeyeceğini kontrol eden ayarlar.
*   **`.env`**: Hassas verilerin (TOKEN, API anahtarları vb.) güvenli tutulduğu ortam değişkenleri.

### 2.2. Veri Akışı ve Takip Mekanizması (Data Flow & Tracking)
Veriler, olaylar (events) tetiklenir ve bu olaylar skor hesaplama motoruna beslenir.

*   **Eventler (Triggerlar):**
    *   **`clientReady.js`**: Bot başladığında çalışır. Sunucudaki tüm üyeleri kontrol eder ve ilk kurulumları yapar. Haftalık sıfırlama ve rol devri işlemlerini tetikler.
    *   **`messageCreate.js`**: Her mesaj gönderildiğinde tetiklenir. Bu olay, mesaj sayısını takip ederek skor hesaplamasına katkıda bulunur.
    *   **`partnerizleme.js`**: Partner sistemine özgü olayları yönetir (örneğin, ortaklık durumlarını takip etme).
*   **Veri Depolama**: Skor verileri ve kanal bazlı ayarlar `croxydb` (Veritabanı) üzerinden tutulur.

### 2.3. İş Mantığı Katmanı (Business Logic)
*   **`src/utils/weeklyScoreboard.js`**: Botun kalbidir.
    *   Kullanıcıların güncel skorlarını (mesaj sayısı, ses süresi, partner vb. baz alınarak) hesaplar.
    *   Haftalık liderleri belirler ve bu sonuçları görsel olarak (Embed) kanallara yansıtır.
    *   Haftalık yetkili/üyelik rollerini otomatik olarak üyeye atama mantığını içerir.

## 3. Mevcut Komutlar ve Etkileşimler (Commands & Interactions)

Kullanıcıların botla etkileşime girdiği ana noktalar şunlardır:

*   **Ayarlar Paneli (`src/commands/ayarlar.js`)**:
    *   Kullanıcılara, `trackMessages` ve `trackPartners` gibi ayarları değiştirebilecek (toggle edilecek) etkileşim panelleri sunar.
    *   İzin verilen kanalların yönetimini sağlayan komutları içerir.
*   **Yetkili Listesi (`src/commands/yetkili-listesi.js`)**: Botun belirlediği yetkili üyeleri listeleme işlevi görür.
*   **Yasa Tasarısı Komutu (`src/commands/yasa-tasarisi-sun.js`)**: Sunucu yönetiminde kullanılacak yasa önerileri veya taslaklarını sunma mekanizmasıdır.

## 4. Kullanılan Komutlar ve Eventler Özeti

| Kategori | Bileşen | Açıklama |
| :--- | :--- | :--- |
| **Eventler** | `messageCreate.js` | Mesaj başına skor katkısı. |
| | `clientReady.js` | Haftalık sıfırlama ve rol atama tetikleyicisi. |
| **Komutlar** | `/yetkili-listesi` | Yetkili üyeleri listeleme. |
| | `/ayarlar` | Ayar (tracking) panellerini yönetme. |
| | `/yasa-tasarisi-sun` | Yasa tasarısı gönderme arayüzü. |

## 5. İş Akışı Özeti (Flow Summary)

1.  **Bot Başlangıcı**: `clientReady.js` çalışır, üyeleri tarar, ayarları yükler.
2.  **Aktivite Takibi**: Kullanıcı mesaj attıkça (`messageCreate.js`), veritabanına skor artışı kaydedilir.
3.  **Haftalık Hesaplama**: Haftalık döngü (örneğin Pazartesi 00:00) tetiklendiğinde, `weeklyScoreboard.js` tüm skorları hesaplar.
4.  **Ödüllendirme**: Hesaplama sonucuna göre, `clientReady.js` veya ilgili fonksiyonlar, yetkili/üyelik rolleri üyeler arasında günceller.
5.  **Yönetim**: Yöneticiler, `/ayarlar` komutu ile skor takibini aktif/pasif edebilir ve yönetim panelleri üzerinden kanal ayarlarını değiştirebilir.

---
**Bu rehber, projenin teknik ve fonksiyonel ana hatlarını özetlemektedir. Her dosyanın spesifik işlevi için ilgili dosyaya bakınız.**