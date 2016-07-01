var Autocomplete = {};


var html = '<div class="grid-100 grid-parent input-search">' +
				'<button type="button" class="label-input open-search" tabIndex="-1">' +
					'<img src="images/icones/lupa-3.svg" />' +
				'</button>' +
				'<input type="text" class="autocomplete-input" {{?it.required}}required{{?}}/>' +
			'</div>' +
			'<ul class="grid-100 grid-parent autocomplete-list{{?it.multiple}} multiple-list{{?}}">' +
			'</ul>';
var loadingLi = '<li class="list-loading"><img src="spinner.gif" /></li>';
var emptyLi = '<li class="empty-list">No results.</li>';
var createNewLi = function (properties, settings) {
	if (settings.postUrl) {
		return '<li class="create-new-item">Create new</li>';
	} else {
		return '';
	}
};
var keyCodes = {
	ARROW_UP: 38,
	ARROW_DOWN: 40,
	ARROW_LEFT: 37,
	ARROW_RIGHT: 39,
	ENTER: 13,
	ESC: 27
};

Autocomplete.checkNewAutocompleteElements = function (container) {
	var components = container.find('.autocomplete-component:not(.autocomplete-ready)');
	initialize(components);
	components.addClass('autocomplete-ready');
};

var initialize = function (elements) {
	elements.each(function () {
		transformIntoAutocomplete($(this));
	});
};

Autocomplete.trigger = function (element, event, obj) {
	element.each(function () {
		if ($(this).hasClass('autocomplete-component') && $(this).hasClass('autocomplete-ready')) {
			triggerEvents($(this), event, obj);
		} else {
			throw 'Not an autocomplete component';
		}
	});
};

Autocomplete.bindEvents = function (element, eventFunctions) {
	if (element.hasClass('autocomplete-component') && element.hasClass('autocomplete-ready')) {
		element.data('events', eventFunctions);
	} else {
		throw 'Not an autocomplete component';
	}
};

var setSingleSelectedOption = function (element, obj, settings) {
	var text = concatPropertiesFromObj(obj, settings.textProperties, settings.textSeparator);
	element.data('selected-value', obj.id);
	element.data('selected-text', text);
	element.find('.autocomplete-input').val(text);
	element.data('value', obj.id);
	element.data('text', text);
};

Autocomplete.setSelectedOption = function (element, obj) {
	var settings = extractSettings(element);
	if (settings.multiple) {
		setMultipleSelectedOption(element, obj);
	} else {
		setSingleSelectedOption(element, obj, settings);
	}
};

Autocomplete.cloneSelection = function (from, to) {
	if (!from.hasClass('autocomplete-ready') || !to.hasClass('autocomplete-ready')) {
		return;
	}

	var id = from.data('value');
	var text = from.data('text');
	to.data('value', id);
	to.data('text', text);
	to.find('.autocomplete-input').val(text);
};

var setMultipleSelectedOption = function (element, obj) {
	if (element.hasClass('autocomplete-ready')) {
		Autocomplete.trigger(element, 'add-multiple-selected-itens', obj);
	} else {
		element.data('selected-value', obj);
	}
};

var defaultEvents = function (element, properties, settings) {
	var events = {
		'force-update-autocomplete': function (searchParameters) {
			properties.autocompleteInput.val(searchParameters.text);
			searchAndShowResultList(properties, settings);
		},
		'add-multiple-selected-itens': function (itens) {
			addSelectedItensToMultipleAutocomplete(properties, settings, itens);
		},
		'set-exclusion-ids': function (ids) {
			properties.excludeIds = ids;
		}
	};
	element.data('default-events', events);
};

var triggerEvent = function (events, event, obj) {
	if (events[event] && typeof events[event] == 'function') {
		events[event](obj);
	}
};

var triggerEvents = function (element, event, obj) {
	triggerEvent(element.data('events') || {}, event, obj);
	triggerEvent(element.data('default-events') || {}, event, obj);
};

var addSelectedItensToMultipleAutocomplete = function (properties, settings, values) {
	properties.selectedLis = $();
	for (var i = 0; i < values.length; i++) {
		processMultipleAutocompleteInclusionNewEntity(properties, settings, values[i]);
	}
	processMultipleAutocompleteBlurEvent(properties, settings);
};

var transformIntoAutocomplete = function (autocompleteContainer) {
	var settings = extractSettings(autocompleteContainer);

	autocompleteContainer.html(doT.template(html, {
		required: settings.inputRequired,
		multiple: settings.multiple
	}));
	var properties = setupProperties(autocompleteContainer),
		settings = extractSettings(autocompleteContainer);
	defaultEvents(properties.autocompleteContainer, properties, settings);
	properties.listJquery.html(loadingLi);

	if (settings.multiple) {
		addSelectedItensToMultipleAutocomplete(properties, settings, settings.selectedValue);
	} else {
		if (!properties.autocompleteInput.val()) {
			properties.autocompleteInput.val(settings.selectedText);
			autocompleteContainer.data('value', settings.selectedValue);
			autocompleteContainer.data('text', settings.selectedText);
		}
	}

	bindChanges(properties, settings);
};

var processSingleAutocompleteInclusionNewEntity = function (properties, settings, newEntity) {
	properties.autocompleteContainer.data('value', newEntity.id);
	properties.autocompleteContainer.data('text', newEntity.name);
	properties.autocompleteContainer.find('.autocomplete-input').focus().val(newEntity.name);
	properties.autocompleteContainer.removeClass('show-select-list');
};

var processMultipleAutocompleteInclusionNewEntity = function (properties, settings, newEntity) {
	properties.inElement = false;
	var newEntityLi = $(getAutocompleteLi(properties, settings, 1, newEntity)),
		checkbox = newEntityLi.find('input[type="checkbox"]'),
		isCheckedNow = !checkbox.prop('checked');
	checkbox.prop('checked', isCheckedNow);
	properties.shouldTriggerFocusHandler = true;

	properties.selectedLis = properties.selectedLis.add(newEntityLi);
	newEntityLi.addClass('li-selected');
	properties.selectedIds.push(newEntityLi.data('value'));
	properties.autocompleteContainer.data('value', properties.selectedIds);
	populateMultipleAutocompleteResultList(properties, settings);
	properties.autocompleteInput.focus();
	properties.ignoreEnter = true;
};

var searchOnList = function (list, id) {
	for (var i = 0; i < list.length; i++) {
		if (list[i].id == id) {
			return list[i];
		}
	}
	return false;
};

var checkPressedKeyIsntSpecialCharacter = function (properties, event) {
	if (event.keyCode == keyCodes.ARROW_UP) {
		if (properties.selectedItem > 0) {
			properties.selectedItem--;
		}
	} else if (event.keyCode == keyCodes.ARROW_DOWN) {
		var realSize = ((properties.resultList.length + properties.selectedLis.size()) || 1) + (properties.canCreate ? 1 : 0);
		if (properties.selectedItem < realSize - 1) {
			properties.selectedItem++;
		}
	} else if (event.keyCode == keyCodes.ENTER) {
		properties.listJquery.find('li').eq(properties.selectedItem).click();
		return false;
	} else if (event.keyCode == keyCodes.ESC) {
		properties.autocompleteContainer.find('.autocomplete-input').blur();
		return false;
	} else if (event.keyCode == keyCodes.ARROW_LEFT || event.keyCode == keyCodes.ARROW_RIGHT) {
		return false;
	}

	if (event.keyCode == keyCodes.ARROW_UP || event.keyCode == keyCodes.ARROW_DOWN) {
		var actualLi = properties.listJquery.find('li').eq(properties.selectedItem);
		actualLi.addClass('active').siblings().removeClass('active');
		if (actualLi.size()) {
			properties.listJquery.scrollTop(actualLi.offset().top - properties.listJquery.offset().top);
		}
		return false;
	}

	return true;
};

var doRequest = function (url, settings) {
	console.info(url, settings);
	settings = settings || {};
	settings.url = url;
	if (settings.type != 'POST'){
	settings.dataType = 'json';
}
	return $.ajax(settings);
};

var makeRequestAndPopulateList = function (properties, settings, data) {
	data.limit = settings.limitResults;
	data.excludeIds = properties.excludeIds;
	properties.listJquery.html(loadingLi);
	properties.autocompleteContainer.addClass('show-select-list');
	doRequest(settings.url, {
		data: data,
		type: 'GET',
		shouldClearOther: 'autocomplete-request'
	}).done(function (resultListRequest) {
		properties.resultList = resultListRequest;
		properties.selectedItem = 0;
		populateResultList(properties, settings);
	});
};

var searchAndShowResultList = function (properties, settings) {
	var textValue = properties.autocompleteInput.val();
	if (textValue.length >= settings.minCharacters) {
		properties.autocompleteInput.prev().hide();
		makeRequestAndPopulateList(properties, settings, {
			text: textValue
		});
	} else {
		properties.autocompleteInput.prev().show();
		properties.autocompleteContainer.removeClass('show-select-list');
	}
};

var bindHoverEvents = function (properties) {
	properties.listJquery.find('li').unbind('hover').hover(function () {
		properties.selectedItem = $(this).addClass('active').siblings().removeClass('active').end().index();
		properties.inElement = true;
	}, function () {
		properties.inElement = false;
	});
};

var concatPropertiesFromObj = function (obj, properties, separator) {
	var result = '';
	for (var i = 0; i < properties.length; i++) {
		result += (separator ? ' ' + separator + ' ' : ' ') + getPropertyFromKey(obj, properties[i]);
	}
	return separator ? result.substring(3).trim() : result.substring(1).trim();
};

var getPropertyFromKey = function (obj, key) {
	var nextSeparator = key.indexOf('.');
	if (nextSeparator < 0) {
		return obj[key] || '';
	} else {
		var rootKey = key.slice(0, nextSeparator);
		var nextKey = key.slice(nextSeparator + 1, key.length);
		var childObject = obj[rootKey];
		if (childObject) {
			return getPropertyFromKey(obj[rootKey], nextKey);
		} else {
			return "";
		}
	}
};

var getAutocompleteLi = function (properties, settings, i, presetEntity) {
	var activeClass = (i == properties.selectedItem ? 'class="active"' : ''),
		checkId = randomId(i),
		checkBox = settings.multiple ? '<input type="checkbox" id="' + checkId + '"/><label for="' + checkId + '" class="checkbox-autocomplete-label"></label>' : '';

	return '<li ' + activeClass + ' data-value="' + (presetEntity || properties.resultList[i]).id + '">' +
		checkBox +
		'<span>' + concatPropertiesFromObj(presetEntity || properties.resultList[i], settings.textProperties, settings.textSeparator) + '</span>' +
		'</li>';
};

var extractSettings = function (autocompleteContainer) {
	var textPropertiesOnData = autocompleteContainer.data('text-property-name');
	var componentData = autocompleteContainer.data();

	return {
		textSeparator: componentData.textSeparator,
		url: componentData.url,
		minCharacters: componentData.minCharacters || 1,
		limitResults: componentData.limitResults || 10,
		textProperties: textPropertiesOnData ? (typeof textPropertiesOnData === 'string' ? [textPropertiesOnData] : textPropertiesOnData) : ['name'],
		selectedValue: autocompleteContainer.data('selected-value') || '',
		selectedText: autocompleteContainer.data('selected-text') || '',
		inputRequired: componentData.required || false,
		postUrl: componentData.postUrl,
		entityName: componentData.entityName || 'Entity',
		multiple: componentData.multiple || false
	};
};

var equalsToSomePropertie = function (text, item, textProperties) {
	for (var i = 0; i < textProperties.length; i++) {
		if (getPropertyFromKey(item, textProperties[i]) == text) {
			return true;
		}
	}
	return false;
};

var populateSingleAutocompleteResultList = function (properties, settings) {
	properties.listJquery.html('');
	if (properties.resultList.length) {
		properties.canCreate = true;
		for (var i = 0; i < properties.resultList.length; i++) {
			properties.listJquery.append(getAutocompleteLi(properties, settings, i));
			if (equalsToSomePropertie(properties.autocompleteInput.val(), properties.resultList[i], settings.textProperties)) {
				properties.canCreate = false;
			}
		}
	} else {
		properties.listJquery.append(emptyLi);
		properties.canCreate = true;
	}

	if (settings.postUrl && properties.canCreate && properties.autocompleteInput.val()) {
		properties.listJquery.append(createNewLi(properties, settings));
	};
};

var populateMultipleAutocompleteResultList = function (properties, settings) {
	properties.listJquery.html(properties.selectedLis);
	if (properties.resultList.length || properties.selectedIds.length) {
		var addedLis = 0;
		properties.canCreate = true;

		for (var i = 0; i < properties.resultList.length && addedLis <= settings.limitResults; i++) {
			if (properties.selectedIds.indexOf(properties.resultList[i].id) == -1) {
				properties.listJquery.append(getAutocompleteLi(properties, settings, i));
				addedLis++;
			}
			if (equalsToSomePropertie(properties.autocompleteInput.val(), properties.resultList[i], settings.textProperties)) {
				properties.canCreate = false;
			}
		}
		properties.listJquery.append(properties.selectedLis.removeClass('active'));
	} else {
		properties.listJquery.append(emptyLi);
		properties.canCreate = true;
	}

	if (settings.postUrl && properties.canCreate && properties.autocompleteInput.val()) {
		properties.listJquery.append(createNewLi(properties, settings));
	};
	bindHoverEvents(properties);
};

var randomId = function (index) {
	return 'autocomplete-checkbox' + index + Math.floor(Math.random() * 10000000000);
};

var processSingleAutocompleteBlurEvent = function (properties, settings) {
	if (!properties.autocompleteInput.val()) {
		properties.autocompleteContainer.data('value', '');
		properties.autocompleteContainer.data('text', '');
		return;
	}

	var actualValue = properties.autocompleteContainer.data('value'),
		selectedObject = searchOnList(properties.resultList, actualValue);
	if (selectedObject) {
		properties.autocompleteInput.val(concatPropertiesFromObj(selectedObject, settings.textProperties, settings.textSeparator));
	} else if (!actualValue) {
		properties.autocompleteInput.val('');
		properties.autocompleteInput.prev().show();
	}
	properties.autocompleteContainer.removeClass('show-select-list');
	if (properties.autocompleteContainer.data('has-changed')) {
		properties.autocompleteInput.focus();
	}
	properties.autocompleteContainer.data('has-changed', false);
	properties.inElement = false;
};

var processMultipleAutocompleteBlurEvent = function (properties, settings) {
	properties.selectedLis = properties.autocompleteContainer.find('input:checked').parents('li');
	properties.selectedIds = [];
	var resultString = '';
	var objs = [];
	properties.selectedLis.each(function () {
		properties.selectedIds.push($(this).data('value'));
		resultString += ', ' + $(this).text();
		var actualObj = {};
		actualObj.id = $(this).data('value');
		actualObj[settings.textProperties[0]] = $(this).text();
		objs.push(actualObj);
	});
	properties.autocompleteContainer.data('value', objs);
	resultString = resultString.substring(2);
	properties.autocompleteContainer.removeClass('show-select-list');
	if (!resultString) {
		properties.autocompleteInput.prev().show();
	} else {
		properties.autocompleteInput.prev().hide();
	}
	properties.autocompleteInput.val(resultString);

};

var processSingleAutocompleteClickOnListEvent = function (properties, settings, clickedLi) {
	properties.inElement = false;
	properties.autocompleteContainer.data('value', clickedLi.data('value'));
	properties.autocompleteContainer.data('text', clickedLi.text());
	properties.autocompleteContainer.data('has-changed', true);
	properties.autocompleteInput.blur();
	triggerEvents(properties.autocompleteContainer, 'selectedItem', {
		name: clickedLi.text(),
		value: clickedLi.data('value')
	});
};

var processMultipleAutocompleteClickOnListEvent = function (properties, settings, clickedLi) {
	properties.inElement = false;

	var checkbox = clickedLi.find('input[type="checkbox"]'),
		isCheckedNow = !checkbox.prop('checked');
	checkbox.prop('checked', isCheckedNow);
	properties.shouldTriggerFocusHandler = false;

	if (isCheckedNow) {
		properties.selectedLis = properties.selectedLis.add(clickedLi);
		clickedLi.addClass('li-selected');
		properties.selectedIds.push(clickedLi.data('value'));
	} else {
		properties.selectedLis = properties.selectedLis.not(clickedLi);
		var index = properties.selectedIds.indexOf(clickedLi.data('value'));
		properties.selectedIds.splice(index, 1);
	}
	properties.autocompleteContainer.data('value', properties.selectedIds);
	populateMultipleAutocompleteResultList(properties, settings);
	properties.autocompleteInput.focus();
};

var processFocusEvent = function (properties, settings) {
	if (properties.shouldTriggerFocusHandler && settings.multiple) {
		properties.autocompleteInput.val('');
		properties.autocompleteContainer.addClass('show-select-list');
		properties.resultList = [];
		populateMultipleAutocompleteResultList(properties, settings);
	}
	properties.shouldTriggerFocusHandler = true;
};

var bindChanges = function (properties, settings) {
	properties.autocompleteInput.unbind('keyup').keyup(function (event) {
		if (!checkPressedKeyIsntSpecialCharacter(properties, event)) {
			return false;
		}

		searchAndShowResultList(properties, settings);
	}).unbind('blur').blur(function () {
		processBlurEvent(properties, $(this), settings);
	}).unbind('focus').focus(function () {
		processFocusEvent(properties, settings);
	}).end().on('click', 'ul li', function () {
		processClickOnListEvent(properties, settings, $(this));
	});
};

var setupProperties = function (autocompleteContainer) {
	return {
		resultList: [],
		listJquery: autocompleteContainer.find('ul'),
		autocompleteInput: autocompleteContainer.find('.autocomplete-input'),
		selectedItem: 0,
		inElement: false,
		autocompleteContainer: autocompleteContainer,
		selectedIds: [],
		selectedLis: $(),
		excludeIds: []
	};
};

var processClickOnListEvent = function (properties, settings, clickedLi) {
	var oldValue = properties.autocompleteContainer.data('value');
	if (clickedLi.hasClass('create-new-item')) {
		var value = properties.autocompleteInput.val();
		properties.autocompleteInput.blur();
		doRequest(settings.postUrl, {
			data: {
				name: value
			},
			type: 'POST'
		}).done(function (newEntity) {
			processInclusionNewEntity(properties, settings, newEntity);
		});
	} else {
		if (settings.multiple) {
			processMultipleAutocompleteClickOnListEvent(properties, settings, clickedLi);
		} else {
			processSingleAutocompleteClickOnListEvent(properties, settings, clickedLi);
		}
		Autocomplete.trigger(properties.autocompleteContainer, 'onChange', {
			oldValue: oldValue,
			newValue: properties.autocompleteContainer.data('value')
		});
	}
};

var processBlurEvent = function (properties, input, settings) {
	if (!properties.inElement) {
		if (settings.multiple) {
			processMultipleAutocompleteBlurEvent(properties, settings);
		} else {
			processSingleAutocompleteBlurEvent(properties, settings);
		}
	}
};

var populateResultList = function (properties, settings) {
	if (settings.multiple) {
		populateMultipleAutocompleteResultList(properties, settings);
	} else {
		populateSingleAutocompleteResultList(properties, settings);
		bindHoverEvents(properties);
	}
};

var processInclusionNewEntity = function (properties, settings, newEntity) {
	if (settings.multiple) {
		processMultipleAutocompleteInclusionNewEntity(properties, settings, newEntity);
	} else {
		processSingleAutocompleteInclusionNewEntity(properties, settings, newEntity);
	}
};
window.autocomplete = Autocomplete;
