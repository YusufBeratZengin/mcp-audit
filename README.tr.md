# mcp-audit
[![CI](https://github.com/YusufBeratZengin/mcp-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/YusufBeratZengin/mcp-audit/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/mcp-audit)](https://www.npmjs.com/package/mcp-audit) [![MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Node](https://img.shields.io/badge/node-%3E%3D20-green)](package.json) [![Dependencies](https://img.shields.io/badge/runtime_dependencies-0-brightgreen)](package.json)

[English](README.md) | [Türkçe](README.tr.md)

MCP sunucu ayarlarında açıkta kalan kimlik bilgilerini, sabitlenmemiş paketleri ve riskli erişim izinlerini denetler.
Çevrim dışı çalışır, çalışma zamanı bağımlılığı yoktur; JSON/JSONC dosyalarını sunucuları başlatmadan ve ayarları değiştirmeden okur.
Yerel proje kopyasında kurulum: `npm install --ignore-scripts --no-audit --no-fund`
Denemek için: `node bin/mcp-audit.mjs examples/insecure.mcp.json --no-color`

![Örnek dosyadan üretilen gerçek mcp-audit çıktısı](docs/demo.svg)

## Demo

Proje kökünde çalıştırın:

```sh
node bin/mcp-audit.mjs examples/insecure.mcp.json --no-color
node bin/mcp-audit.mjs examples/insecure.mcp.json --format json --fail-on none
node bin/mcp-audit.mjs examples/insecure.mcp.json --format sarif --output is/report.sarif --fail-on none
```

İlk komutun çıkış kodu bilerek **1** olur: yapay örnekte yüksek önem düzeyinde bulgular vardır. Gerçek özet satırı:

```text
6 findings (4 high, 1 medium, 1 low) in 1 file, 5 servers.
```

Terminal görseli `npm run demo` ile gerçek çıktıdan üretilir; testler güncelliğini kontrol eder.

## Kurulum

Node.js **20+** gerekir; geliştirme ve kapsam ölçümü için Node 24 önerilir. Yerel sürüm 0.1.0'dır. npm yayını ve paket adının uygunluğu doğrulanmadı; npm rozeti yayımlanmış sürüm garantisi değildir.

Yukarıdaki yerel kurulum komutundan sonra `npm run build` ile paketteki TypeScript bildirimlerini yenileyebilirsiniz. Kurulum yalnızca geliştirme araçlarını ekler; CLI ve JavaScript API hiçbir paket kurmadan doğrudan çalışır. CLI için derleme gerekmez.

## Kullanım

### CLI

```sh
node bin/mcp-audit.mjs --help
node bin/mcp-audit.mjs --list-rules
node bin/mcp-audit.mjs . --no-user
```

Dosya yolu vermezseniz bilinen proje ve kullanıcı ayarları bulunur. `--no-user` yalnızca mevcut projeyi inceler. Dosyaları açıkça belirtirseniz sadece bunlar okunur. Klasör verildiğinde alt projelere girilmeden üç bilinen proje konumu aranır. Tireyle başlayan dosya adlarından önce `--` kullanın.

Çıkış kodları: **0** = eşiğe ulaşan bulgu yok (hiç dosya bulunamadığında da stderr notuyla birlikte 0); **1** = eşikte veya üzerinde bulgu var; **2** = kullanım, dosya okuma/ayrıştırma veya rapor yazma hatası. Okuma hataları bulgulardan önceliklidir; `--fail-on none` bu hataları gizlemez.

### Kütüphane

Paket, TypeScript bildirimleriyle birlikte ESM API sunar:

```js
import { auditText } from 'mcp-audit';
const result = auditText('{"mcpServers":{"remote":{"url":"http://mcp.example.com"}}}', 'config.json');
console.log(result.findings[0].ruleId); // MCP005
```

`auditText(text, file, { ignore?, trust? })`, `{ servers, findings }` döndürür; geçersiz JSON için hata fırlatır. `audit({ paths?, cwd?, home?, platform?, env?, ignore?, trust?, user? })`, `{ files, findings, errors, summary }` döndürür ve hataları `errors` listesinde toplar. `summary`, dosya/sunucu/bulgu sayılarını ve `bySeverity` dağılımını içerir.

Her bulguda `ruleId`, `ruleName`, `severity`, `message`, `fix`, `file`, `line`, `server`, `scope` ve isteğe bağlı `field` bulunur. Satırlar 1'den başlar; belirlenemediğinde 0 kullanılır. Diğer export'lar: `discover`, `knownLocations`, `extractServers`, `display`, `RULES`, `SEVERITIES`, `meets`, `formatText`, `formatJson`, `formatSarif`, `VERSION`. Rapor biçimleyicileri string döndürür; `formatText`, `{ color: true }` seçeneğini kabul eder.

## Örnekler

[Kütüphane örneğini](examples/api.mjs) çalıştırın:

```sh
node examples/api.mjs
```

Gerçek çıktı (bu örnekte MCP006 hariç tutulur):

```text
high     MCP001 github: env.GITHUB_API_KEY looks like a secret written in plain text: hu*** (22 chars)
medium   MCP002 github: npx runs "github-mcp-example" with no version
high     MCP003 files: args[2] gives the server access to the file system root ("/").
high     MCP004 runner: The server is started with bash running a command string, so quoting and injection mistakes become code execution.
high     MCP005 remote: url uses http:// to reach a remote host (http://mcp.example.com)

5 findings in 1 file
```

[examples/insecure.mcp.json](examples/insecure.mcp.json) yalnızca yapay veri ve örnek kullanımına ayrılmış alan adları içerir. Hata bildirimlerine gerçek kimlik bilgisi eklemeyin.

## Yapılandırma / seçenekler

| Seçenek | Varsayılan | Etkisi |
|---|---|---|
| `-f, --format text\|json\|sarif` | `text` | Terminal metni, JSON veya SARIF 2.1.0 |
| `--fail-on low\|medium\|high\|critical\|none` | `high` | Çıkış kodu 1 üreten en düşük önem düzeyi |
| `--ignore MCP001,MCP006` | yok | Kural kimliklerini atlar; büyük/küçük harf duyarsızdır, tekrarlanabilir |
| `--trust "@example/*"` | yerleşik liste | MCP006 registry bulguları için paket adı glob'ları ekler; tekrarlanabilir |
| `--no-user` | kullanıcı taraması açık | Otomatik keşifte kullanıcı dosyalarını atlar |
| `-o, --output file` | stdout | Raporu dosyaya yazar; üst klasör önceden bulunmalıdır |
| `--no-color`, `--color` | TTY algılama | ANSI renklerini belirler; aksi halde `NO_COLOR` varlığı dikkate alınır |
| `--list-rules` | — | Kural açıklamalarını gösterir ve çıkar |
| `-h, --help`, `-v, --version` | — | Yardım veya sürümü gösterir ve çıkar |

Denetleyici için ayrı ayar dosyası gerekmez. `--trust` yalnızca registry kaynaklı yayıncı notlarını susturur; git/URL uyarıları ve diğer kurallar çalışmaya devam eder. Yerleşik liste gereksiz bildirimleri azaltır, yayıncının güvenliğini onaylamaz.

### Bilinen konumlar

| Kapsam / istemci | Konum |
|---|---|
| Claude Code proje | `.mcp.json` |
| Cursor proje | `.cursor/mcp.json` |
| VS Code çalışma alanı | `.vscode/mcp.json` |
| MCP Manifest proje | `mcp-manifest.json` |
| Claude Code kullanıcı | `~/.claude.json` (proje girdileri dahil) |
| Cursor kullanıcı | `~/.cursor/mcp.json` |
| Windsurf kullanıcı | `~/.codeium/windsurf/mcp_config.json` |
| Claude Desktop Windows | `%APPDATA%/Claude/claude_desktop_config.json` |
| Claude Desktop macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop Linux topluluk sürümleri | `$XDG_CONFIG_HOME/Claude/claude_desktop_config.json` |
| VS Code kullanıcı Windows | `%APPDATA%/Code/User/mcp.json` |
| VS Code kullanıcı macOS | `~/Library/Application Support/Code/User/mcp.json` |
| VS Code kullanıcı Linux | `$XDG_CONFIG_HOME/Code/User/mcp.json` |

Linux'ta `XDG_CONFIG_HOME` varsayılanı `~/.config`, Windows'ta `APPDATA` varsayılanı `~/AppData/Roaming` olur. Keşif sınırlı bir aday listesine dayanır; istemcilerin kullandığı yollar değişebilir. Windsurf, Linux topluluk sürümleri ve VS Code kullanıcı konumları `knownLocations()` içinde istemci garantisi yerine `believed` olarak işaretlidir. Diğer istemci, profil ve konumlar için dosya yolunu açıkça verin. Bir settings dosyasındaki iç içe `mcp.servers` yapısı da dosya açıkça belirtildiğinde okunur.

## Nasıl çalışır?

JSON/JSONC ayrıştırma → istemci biçimlerini ortak sunucu yapısına dönüştürme → dokuz bağımsız kural → sıralı bulgular ve düzeltme önerileri. `mcpServers`, `servers`, `mcp.servers` ve Claude Code `projects` yapılarının yanı sıra bağımsız MCP sunucu manifestleri ve araç tanımları da desteklenir. İncelenen ayarlardaki komutlar ve sunucular çalıştırılmaz.

| Kimlik | Denetim |
|---|---|
| MCP001 | Env, header, argüman ve URL içindeki açık kimlik bilgileri |
| MCP002 | Sabitlenmemiş npm/Python paketleri ve container imajları |
| MCP003 | Kök, ev, sistem veya kimlik bilgisi klasörlerine erişim |
| MCP004 | Shell sarmalayıcıları ve bilinen komut çalıştırma sunucuları |
| MCP005 | Yerel olmayan, şifrelenmemiş HTTP/WebSocket bağlantıları |
| MCP006 | Git/URL kurulumları ve tanınmayan registry yayıncıları |
| MCP007 | Manifestlerde joker, kök, shell veya aşırı geniş izinler |
| MCP008 | Araç ve metaverilerde gizli Unicode, sıfır genişlikli boşluk ve Bidi geçersiz kılmaları |
| MCP009 | Araç açıklamalarında prompt injection, talimat geçersiz kılma ve veri sızdırma metinleri |

[Kural ayrıntıları, önem düzeyi istisnaları ve çözüm önerileri](docs/rules.md).

MCP001, bağlantı adreslerinde ve HTTP(S) URL argümanlarında tekrarlanan ve yüzde kodlamalı gizli sorgu parametrelerini denetler. Kodlanmış ortam değişkeni referansları atlanır; saptanan değerlerin hem kodlanmış hem çözülmüş biçimleri `--ignore MCP001` kullanıldığında da maskelenir.

## Sınırlar / gizlilik

Bu araç sezgisel bir statik denetleyicidir; güvenlik açığı veritabanı veya sunucunun güvenli olduğuna dair kanıt sunmaz. Ortam değişkenlerini çözmez, kurulu kodu incelemez, shell script'lerini takip etmez, registry imzalarını veya istemci ayar şemasını doğrulamaz. Tanınmayan yapılar ve bozuk sunucu girdileri atlanır. Shell çözümleme ve satır belirleme yaklaşık sonuç verebilir; karmaşık sarmalayıcılar ve tekrarlanan adlar doğruluğu azaltabilir. Container tag'leri sabitlenmiş sayılır ama değiştirilebilir; digest tercih edin.

Denetim tamamen yereldir: ağ isteği, telemetri ve ayar değişikliği yoktur. Tanınan kimlik bilgileri maskelenir; ayrıştırma hataları girdiden alıntı yapmaz, bağlantı/kaynak uyarıları URL yollarını ve kurulum URL'lerini göstermez. Raporlarda ayar dosyasının yolu, sunucu adı ve alan adları bulunmaya devam eder; paylaşmadan önce kontrol edin. Her olası sır biçimi tanınamaz. CLI yalnızca `--output` ile açıkça istenen raporu yazar.

## Geliştirme

Yerel kurulumdan sonra:

```sh
npm run check
npm run test:coverage
npm run demo
npm pack --dry-run --ignore-scripts
```

`check`; ESLint, strict JavaScript typecheck, bildirim üretimi ve testleri çalıştırır. Testler bütün `*.test.mjs` dosyalarını alt klasörler dahil bulur, çevrim dışı ve tek süreçte çalışır; geçici veriler git tarafından yok sayılan `is/` altına yazılır. `test:coverage` Node 22+ gerektirir; tüm `src/` modülleri için **satır, dal ve fonksiyon kapsamını en az %85** tutar. CI, Ubuntu ve Windows üzerinde Node 20/22/24 ile test yapar; kapsam eşiği Node 24'te uygulanır. `npm run build`, JSDoc'tan `types/` bildirimlerini üretir; API değişikliklerinde bunları da güncelleyin.

## Katkı

[CONTRIBUTING.md](CONTRIBUTING.md), [güvenlik bildirimi](SECURITY.md) ve [davranış kurallarına](CODE_OF_CONDUCT.md) bakın. Yeni kurallar için hem yakalanması gereken durumları hem yanlış pozitifleri test edin.

## Lisans

[MIT](LICENSE) © 2026 Yusuf Berat Zengin.
