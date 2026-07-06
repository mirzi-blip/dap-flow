// Default booking form option seed data.
// Inserted into Supabase the first time initFormOptions() runs on an empty table.

interface RawOption {
  service: string
  fieldKey: string
  fieldLabel: string
  optionValue: string
  optionLabel: string
  sortOrder: number
}

const S = (service: string, fieldKey: string, fieldLabel: string, optionValue: string, optionLabel: string, sortOrder: number): RawOption =>
  ({ service, fieldKey, fieldLabel, optionValue, optionLabel, sortOrder })

export const DEFAULT_FORM_OPTIONS: RawOption[] = [
  // ── Activity types (service cards on page 1) ─────────────────────────────────
  S('__services__', 'activityType', 'Service', 'ASC',                   'ASC',                   0),
  S('__services__', 'activityType', 'Service', 'Audio Services',         'Audio Services',         1),
  S('__services__', 'activityType', 'Service', 'Digital Design',         'Digital Design',         2),
  S('__services__', 'activityType', 'Service', 'Graphics',               'Graphics',               3),
  S('__services__', 'activityType', 'Service', 'Photo Shoot',            'Photo Shoot',            4),
  S('__services__', 'activityType', 'Service', 'Printing',               'Printing',               5),
  S('__services__', 'activityType', 'Service', 'Static Artwork Design',  'Static Artwork Design',  6),
  S('__services__', 'activityType', 'Service', 'Video Editing',          'Video Editing',          7),
  S('__services__', 'activityType', 'Service', 'Video Shoot',            'Video Shoot',            8),

  // ── Static Artwork Design ────────────────────────────────────────────────────
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          'A4',                   'A4',                   0),
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          'A3',                   'A3',                   1),
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          'A2',                   'A2',                   2),
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          'A1',                   'A1',                   3),
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          'A0',                   'A0',                   4),
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          'Letter (8.5"×11")',     'Letter (8.5"×11")',     5),
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          'Legal (8.5"×14")',      'Legal (8.5"×14")',      6),
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          'Tabloid (11"×17")',     'Tabloid (11"×17")',     7),
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          '4R (4"×6")',            '4R (4"×6")',            8),
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          '5R (5"×7")',            '5R (5"×7")',            9),
  S('Static Artwork Design', 'dsw_paperSize',   'Size',          'Custom',               'Custom',               10),
  S('Static Artwork Design', 'dsw_material',    'Material Type', 'Tarpaulin',            'Tarpaulin',             0),
  S('Static Artwork Design', 'dsw_material',    'Material Type', 'Glossy Paper',         'Glossy Paper',          1),
  S('Static Artwork Design', 'dsw_material',    'Material Type', 'Matte Paper',          'Matte Paper',           2),
  S('Static Artwork Design', 'dsw_material',    'Material Type', 'Canvas',               'Canvas',                3),
  S('Static Artwork Design', 'dsw_material',    'Material Type', 'Vinyl',                'Vinyl',                 4),
  S('Static Artwork Design', 'dsw_material',    'Material Type', 'Sintra Board',         'Sintra Board',          5),
  S('Static Artwork Design', 'dsw_material',    'Material Type', 'Foam Board',           'Foam Board',            6),
  S('Static Artwork Design', 'dsw_material',    'Material Type', 'Sticker Paper',        'Sticker Paper',         7),
  S('Static Artwork Design', 'dsw_material',    'Material Type', 'Fabric',               'Fabric',                8),
  S('Static Artwork Design', 'dsw_material',    'Material Type', 'Custom',               'Custom',                9),
  S('Static Artwork Design', 'dsw_orientation', 'Orientation',   'Portrait',             'Portrait',              0),
  S('Static Artwork Design', 'dsw_orientation', 'Orientation',   'Landscape',            'Landscape',             1),
  S('Static Artwork Design', 'dsw_orientation', 'Orientation',   'Square',               'Square',                2),

  // ── Printing ─────────────────────────────────────────────────────────────────
  S('Printing', 'dsw_paperSize',   'Paper Size',    'A4',                   'A4',                   0),
  S('Printing', 'dsw_paperSize',   'Paper Size',    'A3',                   'A3',                   1),
  S('Printing', 'dsw_paperSize',   'Paper Size',    'A2',                   'A2',                   2),
  S('Printing', 'dsw_paperSize',   'Paper Size',    'A1',                   'A1',                   3),
  S('Printing', 'dsw_paperSize',   'Paper Size',    'A0',                   'A0',                   4),
  S('Printing', 'dsw_paperSize',   'Paper Size',    'Letter (8.5"×11")',     'Letter (8.5"×11")',     5),
  S('Printing', 'dsw_paperSize',   'Paper Size',    'Legal (8.5"×14")',      'Legal (8.5"×14")',      6),
  S('Printing', 'dsw_paperSize',   'Paper Size',    'Tabloid (11"×17")',     'Tabloid (11"×17")',     7),
  S('Printing', 'dsw_paperSize',   'Paper Size',    '4R (4"×6")',            '4R (4"×6")',            8),
  S('Printing', 'dsw_paperSize',   'Paper Size',    '5R (5"×7")',            '5R (5"×7")',            9),
  S('Printing', 'dsw_paperSize',   'Paper Size',    'Custom',               'Custom',               10),
  S('Printing', 'dsw_material',    'Material Type', 'Tarpaulin',            'Tarpaulin',             0),
  S('Printing', 'dsw_material',    'Material Type', 'Glossy Paper',         'Glossy Paper',          1),
  S('Printing', 'dsw_material',    'Material Type', 'Matte Paper',          'Matte Paper',           2),
  S('Printing', 'dsw_material',    'Material Type', 'Canvas',               'Canvas',                3),
  S('Printing', 'dsw_material',    'Material Type', 'Vinyl',                'Vinyl',                 4),
  S('Printing', 'dsw_material',    'Material Type', 'Sintra Board',         'Sintra Board',          5),
  S('Printing', 'dsw_material',    'Material Type', 'Foam Board',           'Foam Board',            6),
  S('Printing', 'dsw_material',    'Material Type', 'Sticker Paper',        'Sticker Paper',         7),
  S('Printing', 'dsw_material',    'Material Type', 'Fabric',               'Fabric',                8),
  S('Printing', 'dsw_material',    'Material Type', 'Custom',               'Custom',                9),
  S('Printing', 'dsw_orientation', 'Orientation',   'Portrait',             'Portrait',              0),
  S('Printing', 'dsw_orientation', 'Orientation',   'Landscape',            'Landscape',             1),
  S('Printing', 'dsw_orientation', 'Orientation',   'Square',               'Square',                2),
  S('Printing', 'dsw_colorMode',   'Color',         'Colored',              'Colored',               0),
  S('Printing', 'dsw_colorMode',   'Color',         'B&W',                  'B&W',                   1),

  // ── Graphics ─────────────────────────────────────────────────────────────────
  S('Graphics', 'dsw_material',    'Material Type', 'Tarpaulin',            'Tarpaulin',             0),
  S('Graphics', 'dsw_material',    'Material Type', 'Glossy Paper',         'Glossy Paper',          1),
  S('Graphics', 'dsw_material',    'Material Type', 'Matte Paper',          'Matte Paper',           2),
  S('Graphics', 'dsw_material',    'Material Type', 'Canvas',               'Canvas',                3),
  S('Graphics', 'dsw_material',    'Material Type', 'Vinyl',                'Vinyl',                 4),
  S('Graphics', 'dsw_material',    'Material Type', 'Sintra Board',         'Sintra Board',          5),
  S('Graphics', 'dsw_material',    'Material Type', 'Foam Board',           'Foam Board',            6),
  S('Graphics', 'dsw_material',    'Material Type', 'Sticker Paper',        'Sticker Paper',         7),
  S('Graphics', 'dsw_material',    'Material Type', 'Fabric',               'Fabric',                8),
  S('Graphics', 'dsw_material',    'Material Type', 'Custom',               'Custom',                9),
  S('Graphics', 'dsw_orientation', 'Orientation',   'Portrait',             'Portrait',              0),
  S('Graphics', 'dsw_orientation', 'Orientation',   'Landscape',            'Landscape',             1),
  S('Graphics', 'dsw_orientation', 'Orientation',   'Square',               'Square',                2),

  // ── Digital Design ───────────────────────────────────────────────────────────
  S('Digital Design', 'dsw_orientation', 'Asset Type', 'Social Media Graphic', 'Social Media Graphic', 0),
  S('Digital Design', 'dsw_orientation', 'Asset Type', 'Motion Graphic / GIF', 'Motion Graphic / GIF', 1),
  S('Digital Design', 'dsw_orientation', 'Asset Type', 'Digital Banner',        'Digital Banner',        2),
  S('Digital Design', 'dsw_orientation', 'Asset Type', 'Website Creative',      'Website Creative',      3),
  S('Digital Design', 'dsw_orientation', 'Asset Type', 'Email Header',          'Email Header',          4),
  S('Digital Design', 'dsw_orientation', 'Asset Type', 'Other',                 'Other',                 5),

  // ── ASC ──────────────────────────────────────────────────────────────────────
  S('ASC', 'dsw_paperSize', 'Ad Type', 'TVC (TV Commercial)',   'TVC (TV Commercial)',   0),
  S('ASC', 'dsw_paperSize', 'Ad Type', 'Radio Ad',              'Radio Ad',              1),
  S('ASC', 'dsw_paperSize', 'Ad Type', 'Print Ad',              'Print Ad',              2),
  S('ASC', 'dsw_paperSize', 'Ad Type', 'Out-of-Home (OOH)',     'Out-of-Home (OOH)',     3),
  S('ASC', 'dsw_paperSize', 'Ad Type', 'Online Ad / Digital',   'Online Ad / Digital',   4),
  S('ASC', 'dsw_paperSize', 'Ad Type', 'Social Media Content',  'Social Media Content',  5),
  S('ASC', 'dsw_paperSize', 'Ad Type', 'Other',                 'Other',                 6),

  // ── Video Editing ────────────────────────────────────────────────────────────
  S('Video Editing', 'dsw_platform',    'Platform',      'Broadcast',          'Broadcast',          0),
  S('Video Editing', 'dsw_platform',    'Platform',      'TVCX',               'TVCX',               1),
  S('Video Editing', 'dsw_platform',    'Platform',      'Social Media',       'Social Media',       2),
  S('Video Editing', 'dsw_dimensions',  'Resolution',    '720p (HD)',           '720p (HD)',           0),
  S('Video Editing', 'dsw_dimensions',  'Resolution',    '1080p (Full HD)',     '1080p (Full HD)',     1),
  S('Video Editing', 'dsw_dimensions',  'Resolution',    '1440p (2K)',          '1440p (2K)',          2),
  S('Video Editing', 'dsw_dimensions',  'Resolution',    '2160p (4K)',          '2160p (4K)',          3),
  S('Video Editing', 'dsw_dimensions',  'Resolution',    'Custom',             'Custom',             4),
  S('Video Editing', 'dsw_orientation', 'Orientation',   'Landscape (16:9)',    'Landscape (16:9)',    0),
  S('Video Editing', 'dsw_orientation', 'Orientation',   'Portrait (9:16)',     'Portrait (9:16)',     1),
  S('Video Editing', 'dsw_orientation', 'Orientation',   'Square (1:1)',        'Square (1:1)',        2),
  S('Video Editing', 'dsw_paperSize',   'Output Format', 'MP4',                'MP4',                0),
  S('Video Editing', 'dsw_paperSize',   'Output Format', 'MOV',                'MOV',                1),
  S('Video Editing', 'dsw_paperSize',   'Output Format', 'AVI',                'AVI',                2),
  S('Video Editing', 'dsw_paperSize',   'Output Format', 'MKV',                'MKV',                3),
  S('Video Editing', 'dsw_paperSize',   'Output Format', 'WebM',               'WebM',               4),
  S('Video Editing', 'dsw_material',    'Style / Tone',  'Promotional',        'Promotional',        0),
  S('Video Editing', 'dsw_material',    'Style / Tone',  'Documentary',        'Documentary',        1),
  S('Video Editing', 'dsw_material',    'Style / Tone',  'Cinematic',          'Cinematic',          2),
  S('Video Editing', 'dsw_material',    'Style / Tone',  'Social Media Reel',  'Social Media Reel',  3),
  S('Video Editing', 'dsw_material',    'Style / Tone',  'Tutorial / How-To',  'Tutorial / How-To',  4),
  S('Video Editing', 'dsw_material',    'Style / Tone',  'Event Coverage',     'Event Coverage',     5),
  S('Video Editing', 'dsw_material',    'Style / Tone',  'Music Video',        'Music Video',        6),
  S('Video Editing', 'dsw_material',    'Style / Tone',  'Other',              'Other',              7),

  // ── Video Shoot ──────────────────────────────────────────────────────────────
  S('Video Shoot', 'dsw_shootTypeDetail', 'Type of Shoot', 'Stream',                   'Stream',                   0),
  S('Video Shoot', 'dsw_shootTypeDetail', 'Type of Shoot', 'BTS (Behind the Scenes)', 'BTS (Behind the Scenes)', 1),
]
