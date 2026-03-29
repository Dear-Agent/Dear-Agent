// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Marketplace {
    struct Listing {
        address seller;
        address tokenAddress;
        uint256 amount;
        uint256 pricePerUnit;
        bool active;
    }

    Listing[] public listings;

    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address tokenAddress,
        uint256 amount,
        uint256 pricePerUnit
    );

    function list(
        address tokenAddress,
        uint256 amount,
        uint256 pricePerUnit
    ) external returns (uint256) {
        uint256 id = listings.length;
        listings.push(Listing({
            seller: msg.sender,
            tokenAddress: tokenAddress,
            amount: amount,
            pricePerUnit: pricePerUnit,
            active: true
        }));

        emit Listed(id, msg.sender, tokenAddress, amount, pricePerUnit);
        return id;
    }

    function buy(uint256 listingId) external payable {
        Listing storage l = listings[listingId];
        require(l.active, "Not active");
        require(msg.value >= l.amount * l.pricePerUnit, "Insufficient payment");
        l.active = false;
    }

    function getListing(uint256 listingId)
        external
        view
        returns (Listing memory)
    {
        return listings[listingId];
    }

    function listingCount() external view returns (uint256) {
        return listings.length;
    }
}
