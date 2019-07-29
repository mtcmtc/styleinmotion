;(function ( $, window, document, undefined ) {

        /*  OUTFIT PULLER
    **  ----------------------------------------------------------------------------------------------------
    **  Version:            1.0
    **  Description:        Pulls outfit data from a category and then places the resulting outfit images
    **                      into the provided element. Along with the image, data attributes are set on the
    **                      image tag that correspond to the outfit's name, price and id.
    **
    **  NOTE:               THIS ONLY WORKS IF BOTH THE CATEGORY ID AND THE FACET STYLE ID ARE SUPPLIED.
    **                      MUST ONLY CONTAIN OUTFITS IN THE SORT.
    **
    **  To-Be Added:        Better logic for traversing through the JSON object in case no facet style ID is 
    **                      available and the sort is a mix of outfits and regular products.
    **
    **  Author:             Jacob Moretti
    **  Last Modified:      7/26/2013
    */

    // Create the defaults once
    var pluginName = "outfitPuller",
        defaults = {
            local:                      false,
            categoryId:                 null,
            facetStyleId:               null,
            productSearchUrl:           'http://bananarepublic.gap.com/resources/productSearch/v1/search',
            outfitData:                 null,
            numOfOutfitsToDisplay:      5,
            imgClass:                   'WCD_outfit-image',
            referralCID: 1076156,//us sale dp
            referralCIID: 12899586,
                            
            random:                     false,
            ajaxDoneEventName:          'outfitPullerAjaxCallDone',
            ajaxFailEventName:          'outfitPullerAjaxCallFail',
            ajaxFailHtml:               '<p>Sorry, there was an error retrieving outfits.</p>'
            //outfitName.replace(/\s/g,'');
            
        };

    // The actual plugin constructor
    function Plugin( element, options ) {
        this.element = element;
        this.$element = jQuery(element);

        // jQuery has an extend method which merges the contents of two or
        // more objects, storing the result in the first object. The first object
        // is generally empty as we don't want to alter the default options for
        // future instances of the plugin
        this.options = jQuery.extend( {}, defaults, options );

        // set our outfitData to an ArrayLiteral
        this.options.outfitData = [];

        this._defaults = defaults;
        this._name = pluginName;

        this.init();
    }

    Plugin.prototype = {

        init: function() {
            // maintain reference of this Object when facing scope issues
            var that = this;

            // append categoryId and facetStyleId to our productSearchUrl
            if(this.options.local){
                this.options.productSearchUrl = 'http://www.brol.wip.gidapps.com/resources/productSearch/v1/search'
                //console.log(this.options.productSearchUrl)
            }
            this.options.productSearchUrl += "?cid=" + this.options.categoryId + "&style=" + this.options.facetStyleId;
            //console.log(this.options.productSearchUrl)
            // this.options.productSearchUrl += "?cid=" + this.options.categoryId;
                            //console.info(this.options.categoryId);
            // do our ajax request
            this.doAjaxRequest();

            // listen for our custom event when ajax call is done
            this.$element.on(this.options.ajaxDoneEventName, function() {
                // do clean up
                that.cleanUp();
                that.pushImagesToElement();
                jQuery('#outfitSliderContainer .loading').hide();
                that.fireEventDone(); 
            });

            // listen for our custom event when ajax call has failed
            this.$element.on(this.options.ajaxFailEventName, function() {
                // do clean up
                that.cleanUp();
                that.$element.append(that.options.ajaxFailHtml);
            });

        },

        // method for our ajax request
        doAjaxRequest: function(el, options) {
            // maintain reference of this Object when facing scope issues
            var that = this;

            // ajax call to product search API
            var jqxhr = jQuery.ajax({
                url: this.options.productSearchUrl,
                context: this.element
            });

            jqxhr.done(function(data) {  // ajax call successful

                    // returned data is JSON object
                    var productData = data;

                    // we're looking for just the childProducts as each of these are a new outfit
                    //var childProducts = productData.productCategoryFacetedSearch.productCategory.childProducts; // use for EU/UK Product Pull
                    var childProducts = productData.productCategoryFacetedSearch.productCategory.childCategories.childProducts; // use for US Product Pull

                    // fix for PRODUCTION. Not returning same data as Preview environment.
                    if ( childProducts == null ) {
                        childProducts = productData.productCategoryFacetedSearch.productCategory.childCategories[0].childProducts;                            
                    }

                    // loop through each of the childProducts
                    jQuery.each(childProducts, function(index, value) {
                        // grab the data we need for the outfit
                        var outfitImageUrl = value.quicklookImage.path;
                        var outfitName = value.name;
                        //var outfitPrice = value.mupMessage;  // keep in mind this price is NOT the price of the whole outfit - only the key item associated with the outfit
                        var outfitPrice = value.price.currentMinPrice;
                        
                        var outfitOriginalPrice = value.price.regularMaxPrice; //Original price before the markdown
                        var outfitId = value.businessCatalogItemId;

                        // now push to our outfitData array
                        that.options.outfitData.push({
                            'outfitImageUrl': outfitImageUrl,
                            'outfitName': outfitName,
                            
                            'outfitPrice': outfitPrice,
                            'outfitOriginalPrice':outfitOriginalPrice,
                            'outfitId': outfitId
                        });

                        //limit the call on json data
                        if ( index === 20 ) {
                          return false;
                        }
                    });

                    // send an event to document to let us know our ajax call is done
                    that.$element.trigger(that.options.ajaxDoneEventName, [that.options.outfitData]);
                })
                .fail(function(jqXHR, textStatus, errorThrown) {    // ajax call failed
                    // send an event to document to let us know our ajax call failed
                    that.$element.trigger(that.options.ajaxFailEventName, false);

                    // console.log('jqXHR: ');
                    // console.log(jqXHR);
                    // console.log('textStatus: ');
                    // console.log(textStatus);
                    // console.log('errorThrown: ');
                    // console.log(errorThrown);
                });
        },

        pushImagesToElement: function() {

            //console.log('pushImagesToElement call');

            // maintain reference of this Object when facing scope issues
            var that = this;
            
            // this array holds the key index in relation to the outfitData array
            var selectedOutfits = [];

            // rename for sanity
            var outfitData = this.options.outfitData;
            
            // this variable tells you how many outfits the facet id has in array
            var availableSelectedOutfits = this.options.outfitData.length + 1;

            // this variable holds the number of images to display
            var numOfOutfitsToDisplay =  this.options.numOfOutfitsToDisplay <= availableSelectedOutfits ? this.options.numOfOutfitsToDisplay : this.options.outfitData.length;

            // if random is true
            if(this.options.random) {
                // we don't want duplicate outfits while we randomly grab them
                // our while loop helps us to make sure we collect the number of outfits we want
                while (selectedOutfits.length < numOfOutfitsToDisplay) {
                    // generate random key for our array
                    var randomKey = Math.floor(Math.random()*outfitData.length);
                    // check if that value already exists in the array
                    var isDuplicate = this.checkDuplicate(randomKey, selectedOutfits);

                    // if it is not a duplicate
                    // then we push the values to our array
                    if(!isDuplicate) {
                        selectedOutfits.push(randomKey);
                    }
                }

                // go through each of our array indexes
                jQuery.each(selectedOutfits, function(index, value) {
                    var outfitImageUrl = outfitData[value]['outfitImageUrl'];
                    var outfitName = outfitData[value]['outfitName'];
                    var outfitPrice = outfitData[value]['outfitPrice'];
                    var outfitOriginalPrice = outfitData[value]['outfitPrice'];
                    var outfitId = outfitData[value]['outfitId'];  
                    //var outfitPriceString = outfitData[value]['outfitPrice'].replace('$','');
                    //var outfitPrice = "$" + (Number(outfitPriceString).toFixed(2));      
                   
                    
                    //var wcdCurrencySymbol = '$';
                    //if( wcdEUUKSite == 'eu' ) wcdCurrencySymbol = '&euro;';
                    // console.log(index);

                    // we use data-attributes for outfit name, price and ID
                    // this way if we need them for a later time, the additional code can be written to handle those
                    that.$element.append(
                           /*'<li class="g-1-2 g-xl-1-4">'+
                                '<img class="' + that.options.imgClass + '" src="/Asset_Archive/BRWeb/content/0011/894/448/assets/1214_UK_StartOfSale_DP_BB-w.jpg" alt="Banana Republic" />' +
                            '</li>'+*/
                           
                            '<li class="g-1-2 g-xl-1-4">'+
                                                            ///browse/product.do?cid=1027401&vid=1&pid=187236002
                                                                    '<a href="/browse/product.do?cid='+that.options.categoryId+'&pid='+outfitId+'&mlink='+that.options.referralCID+','+that.options.referralCIID+','+outfitId+'&clink='+that.options.referralCIID+','+outfitName+'">'+
                                '<img class="' + that.options.imgClass + '" src="' + outfitImageUrl + '" altCatID="' + that.options.categoryId + '" data-price="' + outfitPrice + '" data-id="' + outfitId + '" alt="Banana Republic" />' +
                                '</a>'+
                                /*'<div class="outfitInfoContainer">' + 
                                    '<div class="outfitInfoName">'+ outfitName +'</div>' +    
                                    '<div class="outfitRegPrice">'+ wcdCurrencySymbol +''+ outfitOriginalPrice +'</div>' +
                                    '<div class="outfitInfoPrice">'+ wcdCurrencySymbol +''+ outfitPrice +'</div>' +
                                '</div>'+*/
                            '</li>');


                    //checks price to see if it end in '.0'
                   /* var $origPrice = jQuery('.outfitInfoPrice').eq(index);
                    var checkPrice = $origPrice.html().slice(-2);//gets the last 2 characters of the string
                    if(checkPrice == '.0') {
                        $origPrice.append('0');
                    }*/
                });
                    

            }
            else {  // random is set to false
                jQuery.each(outfitData, function(index, value) {
                    // break out of loop once we've hit our numOfOutfitsToDisplay
                    // console.log(index);
                    if(index >= numOfOutfitsToDisplay)
                        return false;

                    var outfitImageUrl = value['outfitImageUrl'];
                    var outfitName = value['outfitName'];
                    var outfitPrice = Number(value['outfitPrice']).toFixed(2);
                    var outfitOriginalPrice = Number(value['outfitOriginalPrice']).toFixed(2);
                    var outfitId = value['outfitId'];

                    var wcdCurrencySymbol = '$';
                    //if( wcdEUUKSite == 'eu' ) wcdCurrencySymbol = '&euro;';


                    // we use data-attributes for outfit name, price and ID
                    // this way if we need them for a later time, the additional code can be written to handle those
                    // that.$element.append('<img class="' + that.options.imgClass + '" src="' + outfitImageUrl + '" alt="' + outfitName + '" data-price="' + outfitPrice + '" data-id="' + outfitId + '" alt="Banana Republic" />');
                                            //'<img class="' + that.options.imgClass + '" src="' + outfitImageUrl + '" alt="' + outfitName + '" data-price="' + outfitPrice + '" data-id="' + outfitId + '" alt="Banana Republic" />' +
                    that.$element.append(
                            /*'<li class="g-1-2 g-xl-1-4">'+
                                '<img class="" src="/Asset_Archive/BRWeb/content/0011/894/448/assets/1214_UK_StartOfSale_DP_BB-w.jpg" alt="Banana Republic" />' +
                            '</li>'+*/
                            '<li class="g-1-2 g-xl-1-4">'+
                                '<a href="/browse/product.do?cid='+that.options.categoryId+'&pid='+outfitId+'&mlink='+that.options.referralCID+','+that.options.referralCIID+','+outfitId+'&clink='+that.options.referralCIID+','+outfitName+'">'+
                                                                    '<img class="' + that.options.imgClass + '" src="' + outfitImageUrl + '" alt="Banana Republic" />' +
                                '</a>'+
                                    /*                                
                                    '<div class="outfitInfoContainer">' + 
                                    '<div class="outfitInfoName">'+ outfitName +'</div>' +    
                                    '<div class="outfitRegPrice">'+ wcdCurrencySymbol +''+ outfitOriginalPrice +'</div>' +
                                    '<div class="outfitInfoPrice">'+ wcdCurrencySymbol +''+ outfitPrice +'</div>' +
                                '</div>'+
                                '</a>'+*/
                                                                    
                            '</li>'
                            );


                    //checks price to see if it end in '.0'
                   /* var $origPrice = jQuery('.outfitInfoPrice').eq(index);
                    var checkPrice = $origPrice.html().slice(-2);//gets the last 2 characters of the string
                    if(checkPrice == '.0') {
                        $origPrice.append('00');
                    }

                    var $origPrice2 = jQuery('.outfitRegPrice').eq(index);
                    var checkPrice2 = $origPrice2.html().slice(-2);//gets the last 2 characters of the string
                    if(checkPrice2 == '.0' || checkPrice2 == '.5') {
                        $origPrice2.append('0');
                    }*/
                });
            }

        },

        // method for our cleanup
        cleanUp: function() {
            // we want to remove our custom events
            this.$element.off(this.options.ajaxDoneEventName);
            this.$element.off(this.options.ajaxFailEventName);
        },

        // method for checking if a duplicate entry exists in an array
        checkDuplicate: function(value, array) {
            // note: $.inArray() does not support associative arrays or objects
            return (jQuery.inArray(value, array) > -1);
        },

        fireEventDone: function() {
            // console.info('dynamic pull event done 1');
            // window.dispatchEvent(dynamicPullevent);
        }

    };

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[pluginName] = function ( options ) {
        return this.each(function () {
            if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName, new Plugin( this, options ));
            }
        });
    };

})( jQuery, window, document );