const GoldPrice = require('./goldPrice.model');

class GoldPriceService {
  // ------------------------------- get latest gold / metal price ----------------------------
  async getLatest() {
    let price = await GoldPrice.findOne().sort({ updatedAt: -1 }).populate('updatedBy', 'name email');
    if (!price) {
      price = await GoldPrice.create({
        base24KRate: 15700,
        platinumRate: 3500,
        silverRate: 95,
      });
    }
    return price;
  }

  // ------------------------------- update metal rates ----------------------------
  async updateRates(data, userId) {
    const updateData = {
      base24KRate: Number(data.base24KRate) >= 0 ? Number(data.base24KRate) : 0,
      platinumRate: Number(data.platinumRate) >= 0 ? Number(data.platinumRate) : 0,
      silverRate: Number(data.silverRate) >= 0 ? Number(data.silverRate) : 0,
    };

    if (userId) {
      updateData.updatedBy = userId;
    }

    let price = await GoldPrice.findOne().sort({ updatedAt: -1 });
    if (price) {
      price = await GoldPrice.findByIdAndUpdate(price._id, { $set: updateData }, { new: true }).populate('updatedBy', 'name email');
    } else {
      price = await GoldPrice.create(updateData);
    }

    return price;
  }
}

module.exports = new GoldPriceService();
