export type Locale = 'en' | 'ru' | 'uz';

export const locales: Locale[] = ['en', 'ru', 'uz'];

export const defaultLocale: Locale = 'uz';

const resources = {
  en: {
    selection_summary: 'Selection Summary',
    menu_for_banquet: 'MENU FOR BANQUET',
    dish_name: 'Dish name',
    qty_pcs: 'Qty (pcs)',
    date: 'Date',
    customer_information: 'Customer Information',
    name: 'Name',
    phone: 'Phone',
    event_details: 'Event Details',
    hall: 'Hall',
    table_category: 'Table Category',
    guest_count: 'Guest Count',
    selected_menu_items: 'Selected Menu Items',
    included_with_table: 'Included with your table',
    item_name: 'Item Name',
    category: 'Category',
    quantity: 'Quantity',
    unit_price: 'Unit Price',
    total_price: 'Total Price',
    pricing: 'Pricing',
    subtotal: 'Subtotal',
    service_fee: 'Service Fee',
    tax: 'Tax',
    total: 'Total',
    price_per_guest: 'Price per Guest',
    summary: 'Summary',
    thank_you_message: 'Thank you for choosing our banquet services. Your selection has been recorded.',
    total_guests: 'Total guests',
    estimated_total: 'Estimated total',
    original_price: 'Original price',
    discount: 'Discount'
  },
  ru: {
    selection_summary: 'Сводка выбора',
    menu_for_banquet: 'МЕНЮ НА БАНКЕТ',
    dish_name: 'Наименование',
    qty_pcs: 'Количество (шт)',
    date: 'Дата',
    customer_information: 'Информация о клиенте',
    name: 'Имя',
    phone: 'Телефон',
    event_details: 'Детали мероприятия',
    hall: 'Зал',
    table_category: 'Категория стола',
    guest_count: 'Количество гостей',
    selected_menu_items: 'Выбранные блюда',
    included_with_table: 'Включено в стол',
    item_name: 'Название блюда',
    category: 'Категория',
    quantity: 'Количество',
    unit_price: 'Цена за единицу',
    total_price: 'Общая цена',
    pricing: 'Цены',
    subtotal: 'Промежуточный итог',
    service_fee: 'Плата за обслуживание',
    tax: 'Налог',
    total: 'Итого',
    price_per_guest: 'Цена за гостя',
    summary: 'Сводка',
    thank_you_message: 'Спасибо за выбор наших банкетных услуг. Ваш выбор записан.',
    total_guests: 'Всего гостей',
    estimated_total: 'Предполагаемая сумма',
    original_price: 'Цена без скидки',
    discount: 'Скидка'
  },
  uz: {
    selection_summary: 'Tanlov xulosasi',
    menu_for_banquet: 'BANKET MENYUSI',
    dish_name: 'Taom nomi',
    qty_pcs: 'Miqdor (dona)',
    date: 'Sana',
    customer_information: 'Mijoz maʼlumotlari',
    name: 'Ism',
    phone: 'Telefon',
    event_details: 'Tadbir tafsilotlari',
    hall: 'Zal',
    table_category: 'Stol kategoriyasi',
    guest_count: 'Mehmonlar soni',
    selected_menu_items: 'Tanlangan taomlar',
    included_with_table: 'Stol bilan birga',
    item_name: 'Taom nomi',
    category: 'Kategoriya',
    quantity: 'Soni',
    unit_price: 'Birlik narxi',
    total_price: 'Umumiy narx',
    pricing: 'Narxlar',
    subtotal: 'Oraliq hisob',
    service_fee: 'Xizmat haqi',
    tax: 'Soliq',
    total: 'Jami',
    price_per_guest: 'Har bir mehmon uchun narx',
    summary: 'Xulosa',
    thank_you_message: 'Banket xizmatlarimizni tanlaganingiz uchun rahmat. Sizning tanlovingiz saqlanib qoldi.',
    total_guests: 'Jami mehmonlar',
    estimated_total: 'Taxminiy summa',
    original_price: 'Chegirmasiz narx',
    discount: 'Chegirma'
  }
} as const;

type TranslationKey = keyof typeof resources.en;

export function translate(key: TranslationKey, locale: Locale = defaultLocale): string {
  const localeResources = (resources[locale] ?? resources[defaultLocale]) as Record<TranslationKey, string>;
  const fallbackResources = resources[defaultLocale] as Record<TranslationKey, string>;
  return localeResources[key] ?? fallbackResources[key] ?? key;
}