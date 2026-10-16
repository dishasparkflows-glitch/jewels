const ApiError = require('../../utils/ApiError');

const SHOP_FOR_OPTIONS = [
  { value: 'women', label: 'Women', genders: ['Female', 'Unisex'] },
  { value: 'men', label: 'Men', genders: ['Male', 'Unisex'] },
  { value: 'kids', label: 'Kids', genders: ['Kids'] },
];

function getShopForGenders(value) {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string') throw new ApiError(400, 'Invalid Shop For filter');
  const selected = [...new Set(value.split(','))];
  const options = selected.map((key) => SHOP_FOR_OPTIONS.find((option) => option.value === key));
  if (options.some((option) => !option)) throw new ApiError(400, 'Invalid Shop For filter');
  return [...new Set(options.flatMap((option) => option.genders))];
}

module.exports = { SHOP_FOR_OPTIONS, getShopForGenders };
