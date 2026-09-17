# DASHBOARD FASILITAS TEKNIK JATSC (AVENGER) - IMAGE TUNGGAL, DUA LAYANAN
#
# Satu image dipakai dua container: dashboard (server.js) dan e-logbook
# (elogbook/server.js). Keduanya aplikasi Node yang sama persis isinya, cuma
# entry point dan folder kerjanya yang beda - membangun dua image untuk itu
# hanya menggandakan unduhan tanpa menambah apa pun.
#
# Kenapa Alpine cukup, padahal ada SQLite: E-Logbook memakai `node:sqlite`,
# modul BAWAAN Node 24, bukan better-sqlite3. Tidak ada yang perlu dikompilasi,
# jadi tidak ada python/make/gcc di sini dan tidak ada kejutan musl vs glibc.
#
# tzdata WAJIB. Beberapa perhitungan di server.js memakai waktu lokal mesin
# (periode berkala mingguan, "hari ini" di jadwal dinas). Container Linux
# bawaannya UTC; tanpa TZ=Asia/Jakarta, jam 00:00-07:00 WIB dihitung sebagai
# hari kemarin dan pengingat meleset satu hari. Di Windows ini tidak pernah
# terlihat karena mesinnya memang sudah WIB.

FROM node:24-alpine

RUN apk add --no-cache tzdata
ENV TZ=Asia/Jakarta \
    NODE_ENV=production \
    HOST=0.0.0.0

WORKDIR /app

# Dependensi lebih dulu, kode belakangan: selama package-lock.json tidak
# berubah, `docker build` memakai lapisan npm yang sudah ada dan build ulang
# setelah menyunting server.js selesai dalam hitungan detik.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY elogbook/package.json elogbook/package-lock.json ./elogbook/
RUN cd elogbook && npm ci --omit=dev

COPY . .

# Titik pasang volume dibuat di sini, bukan dibiarkan dibuat Docker sebagai
# root: volume baru mewarisi pemilik folder ini dari image, jadi proses yang
# jalan sebagai `node` (bukan root) bisa menulis ke sana sejak container
# pertama. Kalau dilewati, E-Logbook gagal membuat elogbook.db dengan EACCES.
RUN mkdir -p data public/foto elogbook/data elogbook/uploads cadangan \
 && chown -R node:node /app

USER node

EXPOSE 3000 3100

# Bawaan: dashboard. Container e-logbook menimpanya lewat compose.
CMD ["node", "server.js"]
