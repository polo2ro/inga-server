'use strict';


exports = module.exports = function(user, account) {



    /**
     * Get the promise for the available quantity
     * @param   {Right} right
     * @param   {RightRenewal} renewal
     * @returns {Promise} resolve to a number
     */
    function getRenewalQuantity(renewal) {

        if (account.arrival > renewal.finish) {
            return null;
        }

        return renewal.getUserQuantityStats(user);
    }




    /**
     * add renewals into the right object
     * @param {Right} rightDocument
     * @param {object} beneficiary      The object will be modified
     * @param {Array} renewals
     * @param {Date} moment
     * @returns {Promise}               Resolve to
     */
    function processRenewals(rightDocument, beneficiary, renewals, moment)
    {

        beneficiary.renewals = [];
        beneficiary.daysRatio = 1;
        beneficiary.errors = [];
        beneficiary.initial_quantity = 0;
        beneficiary.consumed_quantity = 0;
        beneficiary.available_quantity = 0;
        beneficiary.waiting_quantity = {
            created: 0,
            deleted: 0
        };

        /**
         * Test if the renewal is accounted in beneficiary total
         */
        function inTotal(renewal) {
            return (renewal.start <= moment && renewal.finish >= moment);
        }

        function setRenewal(renewalDocument, stat) {
            let renewalObj = renewalDocument.toObject();
            renewalObj.initial_quantity = stat.initial;
            renewalObj.consumed_quantity = stat.consumed;
            renewalObj.available_quantity = stat.available;
            renewalObj.waiting_quantity = stat.waiting;
            renewalObj.daysRatio = stat.daysratio;

            renewalObj.initial_quantity_dispUnit = rightDocument.getDispUnit(renewalObj.initial_quantity);
            renewalObj.consumed_quantity_dispUnit = rightDocument.getDispUnit(renewalObj.consumed_quantity);
            renewalObj.available_quantity_dispUnit = rightDocument.getDispUnit(renewalObj.available_quantity);
            renewalObj.waiting_quantity.created_dispUnit = rightDocument.getDispUnit(renewalObj.waiting_quantity.created);
            renewalObj.waiting_quantity.deleted_dispUnit = rightDocument.getDispUnit(renewalObj.waiting_quantity.deleted);

            beneficiary.renewals.push(renewalObj);

            if (inTotal(renewalDocument)) {
                beneficiary.initial_quantity += stat.initial;
                beneficiary.consumed_quantity += stat.consumed;
                beneficiary.available_quantity += stat.available;
                beneficiary.waiting_quantity.created += stat.waiting.created;
                beneficiary.waiting_quantity.deleted += stat.waiting.deleted;

                if (stat.daysratio && (!beneficiary.daysRatio || renewalObj.finish > new Date())) {
                    beneficiary.daysRatio = stat.daysratio;
                }
            }

            return renewalDocument;
        }

        function setUnits(rightDocument) {
            beneficiary.right.quantity_dispUnit = rightDocument.getDispUnit(beneficiary.right.quantity);
            beneficiary.initial_quantity_dispUnit = rightDocument.getDispUnit(beneficiary.initial_quantity);
            beneficiary.consumed_quantity_dispUnit = rightDocument.getDispUnit(beneficiary.consumed_quantity);
            beneficiary.available_quantity_dispUnit = rightDocument.getDispUnit(beneficiary.available_quantity);
            beneficiary.waiting_quantity.created_dispUnit = rightDocument.getDispUnit(beneficiary.waiting_quantity.created);
            beneficiary.waiting_quantity.deleted_dispUnit = rightDocument.getDispUnit(beneficiary.waiting_quantity.deleted);

        }


        let promises = renewals
        .map(renewalDocument => {
            renewalDocument.setRightForPromise(rightDocument);
            return getRenewalQuantity(renewalDocument);
        })
        .filter(promise => {
            return null !== promise;
        });



        return Promise.all(promises)
        .then(stats => {
            for (let i=0; i<renewals.length; i++) {
                let renewalDocument = renewals[i];
                let stat = stats[i];
                setRenewal(renewalDocument, stat);
            }
            setUnits(rightDocument);

            return beneficiary;
        })
        .catch(err => {
            // if one renewal fail, we will have an error on the beneficiary object
            beneficiary.errors.push({
                renewal: err.renewal,
                error: err.message
            });
            return beneficiary;
        });

    }


    return processRenewals;
};
