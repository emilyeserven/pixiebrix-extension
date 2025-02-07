/*
 * Copyright (C) 2023 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import React, { useState } from "react";
import Centered from "@/components/Centered";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle, faShieldAlt } from "@fortawesome/free-solid-svg-icons";
import { requestPermissions } from "@/utils/permissions";
import AsyncButton from "@/components/AsyncButton";
import { safeParseUrl } from "@/utils";
import { parse as parseDomain } from "psl";
import useCurrentUrl from "@/pageEditor/hooks/useCurrentUrl";
import useUserAction from "@/hooks/useUserAction";

function getLabel(url: string): string {
  const { hostname } = safeParseUrl(url);
  const result = parseDomain(hostname);
  if ("domain" in result && result.domain) {
    return result.domain;
  }
}

const PermissionsPane: React.FunctionComponent = () => {
  const [rejected, setRejected] = useState(false);

  const url = useCurrentUrl();
  const siteLabel = (url && getLabel(url)) || "this page";

  const onRequestPermission = useUserAction(
    async () => {
      const wasApproved = await requestPermissions({ origins: [url] });
      setRejected(!wasApproved);
    },
    { errorMessage: "Error enabling permissions" },
    [url]
  );

  return (
    <Centered vertically>
      <p>
        <AsyncButton onClick={onRequestPermission} className="btn-">
          <FontAwesomeIcon icon={faShieldAlt} /> Enable PixieBrix on {siteLabel}
        </AsyncButton>
      </p>

      <p className="text-muted small">
        Your browser will prompt you to Allow permissions. <br />
        You can revoke the permissions from PixieBrix&apos;s Settings page.
      </p>

      {rejected && (
        <p className="text-info small">
          <FontAwesomeIcon icon={faInfoCircle} />
          &nbsp; You can grant temporary permissions by clicking on the
          PixieBrix extension menu item in your browser&apos;s extensions
          dropdown.
        </p>
      )}
    </Centered>
  );
};

export default PermissionsPane;
