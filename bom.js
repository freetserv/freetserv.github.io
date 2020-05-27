// vim:ts=4:sw=4:et
// © 2015 Michael Stapelberg
// Licensed under the Apache 2.0 license,
// see https://www.apache.org/licenses/LICENSE-2.0.txt

var octopart_match = 'https://zoctopart.zekjur.net/api/v3/parts/match';

function errorEl(message) {
    return $('<span></span>')
            .addClass('glyphicon')
            .addClass('glyphicon-exclamation-sign')
            .css('margin-right', '0.5em')
            .attr('aria-hidden', true)
            .attr('title', message);
}

// TODO: can we query octopart in a specific currency?
function bom(suffix) {
    var tableId = '#fts-bom-' + suffix + ' table';
    var totalRowId = '#fts-' + suffix;
    // octopart does not allow for more than 20 queries in a single
    // /parts/match call.
    var batchSize = 20;

    var amounts = {};

    var totalPrice = {
        "price": 0,
    };

    var multiplier = parseInt($('#fts-' + suffix).attr('data-multiplier'), 10);
    var parts = $.map($('#fts-bom-' + suffix + ' tr[data-sku]'),
                      function(el) {
                          $(el).addClass('fts-not-yet-loaded');
                          return {
                              'sku': $(el).attr('data-sku'),
                              'amount': $(el).attr('data-amount')
                          };
                      });

    indicateProgress($('#fts-' + suffix + ' .fts-price .spinner')[0]);

    for (var batch = 0; batch < Math.ceil(parts.length / batchSize); batch++) {
        var queries = [];
        var limit = Math.min((batch*batchSize) + batchSize, parts.length);
        for (var i = (batch*batchSize); i < limit; i++) {
            var sku = parts[i].sku;
            amounts[sku] = parts[i].amount;
            queries.push({"sku": sku, "seller": "Digi-Key"});
        }
        var args = {
            'queries': JSON.stringify(queries),
            'exact_only': true,
            'include[]': 'short_description',
            'show[]': [
                'mpn',
                'manufacturer.name',
                'short_description',
                'offers.seller.name',
                'offers.prices',
            ],
        };

        $.ajax({
	    dataType: "json",
	    cache: true,
	    url: octopart_match,
	    data: args,
	    success: function(response) {
		var newRows;
		$.each(response['results'], function(i, result) {
                    $.each(result['items'], function(j, item) {
			var sku = response['request']['queries'][i]['sku'];
			var amount = amounts[sku] * multiplier;
			var amountSingle = amounts[sku];
			var error;
			var bestPrice;
			var available = false;
			$.each(item['offers'], function(k, offer) {
                            if (offer['seller']['name'] !== 'Digi-Key') {
				return;
                            }
                            available = true;
                            $.each(offer['prices'], function(currency, prices) {
				$.each(prices, function(l, price) {
                                    if (price[0] <= amount && (bestPrice === undefined || price[0] > bestPrice.amount)) {
					bestPrice = {
                                            "amount": price[0],
                                            "price": price[1],
                                            "currency": currency,
					};
                                    }
				});
                            });
			});

			var el = $('tr[data-sku="' + sku + '"]');
			el.children('.fts-bom-item-item')
			    .html(
				$('<span class="manufacturer"></span>')
				    .text(item['manufacturer']['name'])
				    .append(' ')
				    .append(
					$('<abbr></abbr>').text(item['mpn']).attr('title', item['short_description'])));
			el.children('.fts-bom-item-sku')
                            .html(
				$('<a></a>')
				    .attr('href', 'https://www.digikey.com/product-search/en?keywords=' + encodeURIComponent(sku))
				    .text(sku));
			if (!available) {
                            el.find('span.manufacturer').before(
				errorEl('This part might not be sold by Digi-Key anymore.'));
			}

			if (bestPrice !== undefined) {
                            var price = (amount * bestPrice.price).toFixed(2);
                            totalPrice.price += (amount * bestPrice.price);
                            if (totalPrice.currency === undefined) {
				totalPrice.currency = bestPrice.currency;
                            } else if (totalPrice.currency !== bestPrice.currency) {
				// TODO: display a warning, not all currencies were the same, hence the total is not accurate :(
                            }
                            el.find('.fts-bom-item-price')
				.attr('data-total', price)
				.text(price + ' ' + bestPrice.currency);
			} else {
                            el.find('span.manufacturer').before(
				errorEl('Could not determine pricing information'));
			}

			$(el).removeClass('fts-not-yet-loaded');
                    });
		});

		// Append the new BOM table rows to the table (sorted!)
		var rows = $(tableId + ' tbody > tr').detach();
		rows.sort(function(a, b) {
                    return parseFloat($(b).find('td[data-total]').attr('data-total')) -
			parseFloat($(a).find('td[data-total]').attr('data-total'));
		});
		rows.appendTo(tableId);

		// Update total price now that we have the BOM list.
		$(totalRowId)
		    .find('td.fts-price-total')
		    .attr('data-total', totalPrice.price.toFixed(2) + ' ' + totalPrice.currency)
		    .html(totalPrice.price.toFixed(2) + ' ' + totalPrice.currency + '<span class="spinner"></span>');
		if ($('#fts-bom-' + suffix + ' tr[data-sku].fts-not-yet-loaded').size() > 0) {
                    indicateProgress($('#fts-' + suffix + ' .fts-price .spinner')[0]);
		}
		updateDownloadLinks();
		updateTotalPrice();
            },
	});
    }
}
