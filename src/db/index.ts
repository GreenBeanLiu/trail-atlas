import * as SQLite from 'expo-sqlite'

let _db: SQLite.SQLiteDatabase | null = null

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('trail-atlas.db')
    migrate(_db)
  }
  return _db
}

function migrate(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS tracks (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL,
      note      TEXT    NOT NULL DEFAULT '',
      tags      TEXT    NOT NULL DEFAULT '',
      distance  REAL    NOT NULL DEFAULT 0,
      elev_gain REAL    NOT NULL DEFAULT 0,
      duration  INTEGER NOT NULL DEFAULT 0,
      date      TEXT    NOT NULL,
      created_at TEXT   NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS track_points (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id   INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      lat        REAL    NOT NULL,
      lon        REAL    NOT NULL,
      elevation  REAL    NOT NULL DEFAULT 0,
      timestamp  TEXT,
      seq        INTEGER NOT NULL DEFAULT 0
    );
  `)
}

export type Track = {
  id: number
  name: string
  note: string
  tags: string
  distance: number
  elev_gain: number
  duration: number
  date: string
  created_at: string
  point_count?: number
}

export type TrackPoint = {
  id: number
  track_id: number
  lat: number
  lon: number
  elevation: number
  timestamp: string | null
  seq: number
}

// ── Tracks ────────────────────────────────────────────────────────

export function listTracks(): Track[] {
  const db = getDb()
  return db.getAllSync<Track>(`
    SELECT t.*, COUNT(p.id) as point_count
    FROM tracks t
    LEFT JOIN track_points p ON p.track_id = t.id
    GROUP BY t.id
    ORDER BY t.date DESC, t.created_at DESC
  `)
}

export function getTrack(id: number): Track | null {
  return getDb().getFirstSync<Track>(
    `SELECT * FROM tracks WHERE id = ?`, id
  )
}

export function insertTrack(track: Omit<Track, 'id' | 'created_at' | 'point_count'>): number {
  const db = getDb()
  const result = db.runSync(
    `INSERT INTO tracks (name, note, tags, distance, elev_gain, duration, date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    track.name, track.note, track.tags,
    track.distance, track.elev_gain, track.duration, track.date
  )
  return result.lastInsertRowId as number
}

export function updateTrack(id: number, update: Partial<Pick<Track, 'name' | 'note' | 'tags'>>): void {
  const db = getDb()
  if (update.name !== undefined) db.runSync(`UPDATE tracks SET name = ? WHERE id = ?`, update.name, id)
  if (update.note !== undefined) db.runSync(`UPDATE tracks SET note = ? WHERE id = ?`, update.note, id)
  if (update.tags !== undefined) db.runSync(`UPDATE tracks SET tags = ? WHERE id = ?`, update.tags, id)
}

export function deleteTrack(id: number): void {
  getDb().runSync(`DELETE FROM tracks WHERE id = ?`, id)
}

// ── Track points ──────────────────────────────────────────────────

export function getTrackPoints(trackId: number): TrackPoint[] {
  return getDb().getAllSync<TrackPoint>(
    `SELECT * FROM track_points WHERE track_id = ? ORDER BY seq ASC`,
    trackId
  )
}

export function insertTrackPoints(
  trackId: number,
  points: Omit<TrackPoint, 'id' | 'track_id'>[]
): void {
  const db = getDb()
  const stmt = db.prepareSync(
    `INSERT INTO track_points (track_id, lat, lon, elevation, timestamp, seq) VALUES (?, ?, ?, ?, ?, ?)`
  )
  try {
    db.withTransactionSync(() => {
      for (const p of points) {
        stmt.executeSync(trackId, p.lat, p.lon, p.elevation, p.timestamp, p.seq)
      }
    })
  } finally {
    stmt.finalizeSync()
  }
}
