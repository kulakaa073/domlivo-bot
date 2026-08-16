export const singlePhoto = {
  update_id: 900001,
  message: {
    message_id: 101,
    from: {id: 111111111, is_bot: false, first_name: 'Blerina'},
    chat: {id: 111111111, type: 'private'},
    date: 1755300000,
    photo: [
      {file_id: 'ph-small', file_unique_id: 'u1', width: 320, height: 240, file_size: 21000},
      {file_id: 'ph-big', file_unique_id: 'u2', width: 1280, height: 960, file_size: 154000},
    ],
    caption: 'Shitet apartament 2+1 ne Parruce, Shkoder. 76 m2, kati 3, 59000 EUR.',
  },
}

export const albumItemWithCaption = {
  update_id: 900002,
  message: {
    message_id: 102,
    from: {id: 111111111, is_bot: false, first_name: 'Blerina'},
    chat: {id: 111111111, type: 'private'},
    date: 1755300001,
    media_group_id: 'mg-777',
    photo: [{file_id: 'alb-1-big', file_unique_id: 'u3', width: 1280, height: 960, file_size: 140000}],
    caption: 'Qera 1+1 te Liqeni, Tirane, 450 euro/muaj, 55 m2, me ashensor dhe parkim.',
  },
}

export const albumItemNoCaption = {
  update_id: 900003,
  message: {
    message_id: 103,
    from: {id: 111111111, is_bot: false, first_name: 'Blerina'},
    chat: {id: 111111111, type: 'private'},
    date: 1755300001,
    media_group_id: 'mg-777',
    photo: [{file_id: 'alb-2-big', file_unique_id: 'u4', width: 1280, height: 960, file_size: 133000}],
  },
}

export const imageDocument = {
  update_id: 900004,
  message: {
    message_id: 104,
    from: {id: 222222222, is_bot: false, first_name: 'Owner'},
    chat: {id: 222222222, type: 'private'},
    date: 1755300002,
    document: {file_id: 'doc-1', file_unique_id: 'u5', file_name: 'IMG_100.jpg', mime_type: 'image/jpeg'},
    caption: 'Продается квартира 3+1 в Тиране, Блоку, 120 м2, 4 этаж, 260000 евро, паркинг.',
  },
}

export const textOnly = {
  update_id: 900005,
  message: {
    message_id: 105,
    from: {id: 111111111, is_bot: false, first_name: 'Blerina'},
    chat: {id: 111111111, type: 'private'},
    date: 1755300003,
    text: 'Shitet garsoniere ne Durres, 40 m2, 52000 EUR',
  },
}

export const startCommand = {
  update_id: 900006,
  message: {
    message_id: 106,
    from: {id: 333333333, is_bot: false, first_name: 'Stranger'},
    chat: {id: 333333333, type: 'private'},
    date: 1755300004,
    text: '/start',
  },
}

export const editedMessageOnly = {update_id: 900007, edited_message: {message_id: 90}}
