// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title FTSO v2 Interface
 * @notice Interface for interacting with Flare Time Series Oracle v2
 */
interface IFtsoV2 {
    /**
     * @notice Returns the current price data for a given feed ID
     * @param feedId The feed ID to query (21 bytes)
     * @return value The price value
     * @return decimals The number of decimal places
     * @return timestamp The timestamp of the price data
     */
    function getFeedById(bytes21 feedId) 
        external 
        view 
        returns (uint256 value, int8 decimals, uint64 timestamp);

    /**
     * @notice Returns the current price data in Wei for a given feed ID
     * @param feedId The feed ID to query (21 bytes)
     * @return value The price value in Wei
     * @return timestamp The timestamp of the price data
     */
    function getFeedByIdInWei(bytes21 feedId) 
        external 
        view 
        returns (uint256 value, uint64 timestamp);

    /**
     * @notice Returns the current price data for multiple feed IDs
     * @param feedIds Array of feed IDs to query
     * @return feedValues Array of price values
     * @return decimals Array of decimal places
     * @return timestamp The timestamp of the price data
     */
    function getFeedsById(bytes21[] calldata feedIds)
        external
        view
        returns (
            uint256[] memory feedValues,
            int8[] memory decimals,
            uint64 timestamp
        );
}

/**
 * @title Contract Registry Interface
 * @notice Interface for accessing the Flare contract registry
 */
interface IContractRegistry {
    /**
     * @notice Returns the FTSO v2 contract address
     * @return The FTSO v2 contract
     */
    function getFtsoV2() external view returns (IFtsoV2);
} 